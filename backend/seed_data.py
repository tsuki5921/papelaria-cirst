"""Dados iniciais da loja.

Os produtos abaixo correspondem às fotos reais enviadas pela loja.
IMPORTANTE: preços e quantidades em estoque são VALORES INICIAIS DE
REFERÊNCIA — devem ser conferidos e ajustados no painel administrativo
antes da publicação. Os dados de contato começam vazios de propósito:
preencha-os em Admin › Configurações (nada é inventado).
"""

CATEGORIES = [
    # slug, nome, ícone
    ("biblias", "Bíblias", "✝"),
    ("livros", "Livros", "📖"),
    ("devocionais", "Devocionais", "🕊"),
    ("kits-presente", "Kits de presente", "🎁"),
    ("cadernos", "Cadernos", "📓"),
    ("canetas", "Canetas", "🖊"),
    ("lapis", "Lápis", "✏"),
    ("mochilas", "Mochilas", "🎒"),
    ("estojos", "Estojos", "👝"),
    ("papeis", "Papéis", "📄"),
    ("acessorios", "Acessórios", "🎀"),
]

PRODUCTS = [
    {
        "slug": "biblia-letra-gigante-harpa-pink",
        "name": "Bíblia Sagrada Letra Gigante — Harpa Avivada e Corinhos (Pink)",
        "category": "biblias",
        "description": (
            "Bíblia Sagrada na tradução Almeida Revista e Corrigida, com Harpa Avivada "
            "e Corinhos. Letra gigante para uma leitura confortável, palavras de Deus em "
            "azul, palavras de Jesus em vermelho, promessas em destaque e mapas coloridos. "
            "Capa pink com acabamento prateado."
        ),
        "price": 9990, "promo": None, "stock": 5, "featured": 1,
        "image": "img/produtos/biblia-letra-gigante-harpa-pink.jpg",
    },
    {
        "slug": "biblia-harpa-deus-e-bom",
        "name": "Bíblia e Harpa “Deus é bom o tempo todo” — Lilás",
        "category": "biblias",
        "description": (
            "Bíblia com Harpa na tradução Almeida Revista e Corrigida. Capa ilustrada em "
            "tons de lilás, com flores e a mensagem “Deus é bom o tempo todo!”. "
            "Um presente delicado para quem você ama."
        ),
        "price": 8990, "promo": 7990, "stock": 5, "featured": 1,
        "image": "img/produtos/biblia-harpa-deus-e-bom.jpg",
    },
    {
        "slug": "biblia-nvi-ele-vive",
        "name": "Bíblia Sagrada NVI “Ele Vive” — Lateral Preta",
        "category": "biblias",
        "description": (
            "Bíblia Sagrada na Nova Versão Internacional (NVI), linguagem clara e atual. "
            "Capa preta minimalista com cruz em contorno e a declaração “Ele Vive”, "
            "lateral das páginas na cor preta."
        ),
        "price": 6990, "promo": None, "stock": 5, "featured": 1,
        "image": "img/produtos/biblia-nvi-ele-vive.jpg",
    },
    {
        "slug": "biblia-yeshua-leao-harpa",
        "name": "Bíblia Sagrada Yeshua — Leão, com Harpa",
        "category": "biblias",
        "description": (
            "Bíblia Sagrada com Harpa, capa com a imagem do Leão da Tribo de Judá e o "
            "nome “Yeshua” em destaque. Visual marcante para o seu tempo diário na Palavra."
        ),
        "price": 7990, "promo": 6990, "stock": 5, "featured": 0,
        "image": "img/produtos/biblia-yeshua-leao-harpa.jpg",
    },
    {
        "slug": "biblia-momentos-com-deus",
        "name": "Bíblia Infantil “Momentos com Deus” — 31 histórias",
        "category": "biblias",
        "description": (
            "Bíblia infantil da Sociedade Bíblica do Brasil com 31 histórias e orações "
            "para a hora de dormir. Ilustrações coloridas e alça para as crianças levarem "
            "para onde quiserem."
        ),
        "price": 5990, "promo": None, "stock": 5, "featured": 0,
        "image": "img/produtos/biblia-momentos-com-deus.jpg",
    },
    {
        "slug": "pao-diario-diario-de-oracao",
        "name": "Pão Diário — Diário de Oração",
        "category": "devocionais",
        "description": (
            "Diário de Oração Pão Diário, para registrar pedidos, agradecimentos e o que "
            "Deus fala ao seu coração. Capa floral com detalhes dourados e o versículo de "
            "Ezequiel 36:26."
        ),
        "price": 4990, "promo": None, "stock": 5, "featured": 1,
        "image": "img/produtos/pao-diario-diario-de-oracao.jpg",
    },
    {
        "slug": "as-5-linguagens-do-amor",
        "name": "As 5 Linguagens do Amor — Gary Chapman (3ª edição)",
        "category": "livros",
        "description": (
            "Best-seller do New York Times. Gary Chapman mostra como expressar um "
            "compromisso de amor ao seu cônjuge, descobrindo a linguagem do amor de cada um. "
            "3ª edição."
        ),
        "price": 4490, "promo": 3990, "stock": 5, "featured": 0,
        "image": "img/produtos/as-5-linguagens-do-amor.jpg",
    },
    {
        "slug": "kit-oi-deus-sou-eu-de-novo",
        "name": "Kit Presente “Oi Deus, sou eu de novo” + Caneca",
        "category": "kits-presente",
        "description": (
            "Kit presente com o livro “Oi Deus, sou eu de novo” (Volume 1), de Deive "
            "Leonardo, acompanhado de caneca, em embalagem azul com celofane e laço. "
            "Pronto para presentear."
        ),
        "price": 7990, "promo": None, "stock": 5, "featured": 1,
        "image": "img/produtos/kit-oi-deus-sou-eu-de-novo.jpg",
    },
]

DEFAULT_SETTINGS = {
    "store_name": "Papelaria Cristã",
    "whatsapp": "",      # somente dígitos com DDI, ex.: 5511999999999
    "phone": "",
    "email": "",
    "address": "",
    "hours": "",
    "instagram": "",     # URL completa
    "facebook": "",      # URL completa
}
