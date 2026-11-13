"""Certificado HTTPS para rodar a loja no seu computador (https://localhost).

Se existirem `data/certs/cert.pem` e `data/certs/key.pem` (por exemplo, gerados pelo
mkcert, que o navegador reconhece como confiáveis), eles são usados. Caso contrário,
um certificado autoassinado é criado automaticamente na primeira execução.
"""
import datetime
import ipaddress
from pathlib import Path


def ensure_certificate(folder):
    folder = Path(folder)
    cert, key = folder / "cert.pem", folder / "key.pem"
    if cert.exists() and key.exists():
        return str(cert), str(key)

    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("Para usar HTTPS instale as dependências: pip install -r requirements.txt") from exc

    folder.mkdir(parents=True, exist_ok=True)
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Papelaria Cristã (desenvolvimento)"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=825))
        .add_extension(x509.SubjectAlternativeName([
            x509.DNSName("localhost"),
            x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
            x509.IPAddress(ipaddress.ip_address("::1")),
        ]), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .sign(private_key, hashes.SHA256())
    )
    key.write_bytes(private_key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    cert.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    return str(cert), str(key)
