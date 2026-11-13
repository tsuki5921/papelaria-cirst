"""HTTPS local sem aviso de segurança ("Sua conexão não é particular").

Como funciona (mesma ideia da ferramenta mkcert):
1. Na primeira execução é criada uma *autoridade certificadora local* (data/certs/ca.pem).
   Ela é RESTRITA: só pode assinar certificados para localhost e endereços de rede
   privada (127.x, 10.x, 172.16-31.x, 192.168.x). Mesmo que alguém copiasse a chave,
   não conseguiria imitar sites da internet.
2. O certificado do servidor (cert.pem) é assinado por ela.
3. A autoridade é registrada como confiável no sistema (Windows: certutil; macOS:
   Keychain; Linux: banco NSS usado pelo Chrome). Isso pede confirmação UMA vez.

Se você colocar em data/certs/ um cert.pem/key.pem seu (ex.: do mkcert), ele é usado
como está e nada disso é feito.
"""
import datetime
import ipaddress
import os
import platform
import shutil
import subprocess
from pathlib import Path

CA_NAME = "Papelaria Crista - certificado local"
MARKER = "gerado-automaticamente.txt"   # lista de IPs do certificado criado aqui
TRUSTED = "ca-confiavel.txt"             # registra que a autoridade já foi instalada
PRIVATE_NETS = ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16",
                "::1/128", "fc00::/7", "fe80::/10"]


def _now():
    return datetime.datetime.now(datetime.timezone.utc)


def _ensure_ca(folder):
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    ca_cert, ca_key = folder / "ca.pem", folder / "ca-key.pem"
    if ca_cert.exists() and ca_key.exists():
        return (x509.load_pem_x509_certificate(ca_cert.read_bytes()),
                serialization.load_pem_private_key(ca_key.read_bytes(), password=None))

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, CA_NAME),
                      x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Papelaria Crista (uso local)")])
    cert = (
        x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(_now() - datetime.timedelta(minutes=5))
        .not_valid_after(_now() + datetime.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(x509.KeyUsage(digital_signature=True, key_cert_sign=True, crl_sign=True,
                                     content_commitment=False, key_encipherment=False, data_encipherment=False,
                                     key_agreement=False, encipher_only=False, decipher_only=False), critical=True)
        .add_extension(x509.NameConstraints(
            permitted_subtrees=[x509.DNSName("localhost"),
                                *[x509.IPAddress(ipaddress.ip_network(n)) for n in PRIVATE_NETS]],
            excluded_subtrees=None), critical=True)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .sign(key, hashes.SHA256())
    )
    ca_key.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                         serialization.NoEncryption()))
    try:
        os.chmod(ca_key, 0o600)
    except OSError:
        pass
    ca_cert.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    (folder / TRUSTED).unlink(missing_ok=True)  # nova autoridade: precisa ser instalada de novo
    return cert, key


def ensure_certificate(folder, extra_ips=()):
    """Retorna (cert.pem, key.pem). ImportError sobe se 'cryptography' não estiver instalado."""
    folder = Path(folder)
    cert, key = folder / "cert.pem", folder / "key.pem"
    marker = folder / MARKER
    wanted = sorted({"127.0.0.1", "::1", *[ip for ip in extra_ips if ip]})
    if cert.exists() and key.exists():
        if not marker.exists():
            return str(cert), str(key)  # certificado próprio (mkcert etc.) é sempre respeitado
        if set(wanted) <= set(marker.read_text().split()) and (folder / "ca.pem").exists():
            return str(cert), str(key)

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

    folder.mkdir(parents=True, exist_ok=True)
    ca_cert, ca_key = _ensure_ca(folder)
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")]))
        .issuer_name(ca_cert.subject)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(_now() - datetime.timedelta(minutes=5))
        .not_valid_after(_now() + datetime.timedelta(days=397))  # limite aceito pelos navegadores
        .add_extension(x509.SubjectAlternativeName([
            x509.DNSName("localhost"), *[x509.IPAddress(ipaddress.ip_address(ip)) for ip in wanted]]), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.KeyUsage(digital_signature=True, key_encipherment=True, content_commitment=False,
                                     data_encipherment=False, key_agreement=False, key_cert_sign=False,
                                     crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
        .sign(ca_key, hashes.SHA256())
    )
    key.write_bytes(private_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                              serialization.NoEncryption()))
    # cert.pem leva a cadeia completa (servidor + autoridade)
    cert.write_bytes(certificate.public_bytes(serialization.Encoding.PEM) + ca_cert.public_bytes(serialization.Encoding.PEM))
    marker.write_text("\n".join(wanted))
    return str(cert), str(key)


def _run(cmd, timeout=120):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode == 0, (r.stdout + r.stderr).strip()
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, str(exc)


def trust_ca(folder, force=False):
    """Registra a autoridade local como confiável. Retorna (ok, mensagem)."""
    folder = Path(folder)
    ca = folder / "ca.pem"
    flag = folder / TRUSTED
    if not ca.exists():
        return True, "Usando certificado próprio."
    if flag.exists() and not force:
        return True, "Certificado local já é confiável."

    system = platform.system()
    if system == "Windows":
        print("  O Windows vai perguntar se deseja instalar o certificado da Papelaria Cristã.")
        print("  Clique em 'Sim' (vale só para este computador e a sua rede).")
        ok, out = _run(["certutil", "-user", "-addstore", "Root", str(ca)])
    elif system == "Darwin":
        print("  O macOS vai pedir sua senha para confiar no certificado da Papelaria Cristã.")
        keychain = str(Path.home() / "Library/Keychains/login.keychain-db")
        ok, out = _run(["security", "add-trusted-cert", "-r", "trustRoot", "-k", keychain, str(ca)])
    else:
        nssdb = Path.home() / ".pki" / "nssdb"
        if not shutil.which("certutil"):
            return False, "Instale 'libnss3-tools' (certutil) para o Chrome confiar no certificado."
        nssdb.mkdir(parents=True, exist_ok=True)
        if not (nssdb / "cert9.db").exists():
            _run(["certutil", "-d", f"sql:{nssdb}", "-N", "--empty-password"])
        ok, out = _run(["certutil", "-d", f"sql:{nssdb}", "-A", "-t", "C,,", "-n", CA_NAME, "-i", str(ca)])
    if ok:
        flag.write_text(system)
        return True, "Certificado local instalado: o navegador vai mostrar o cadeado normalmente."
    return False, f"Não foi possível registrar o certificado automaticamente ({out[:160]})."
