// Templates de checklist da Vistoria Técnica (V.T.).
//
// Ao pré-preencher a VT, a gestão escolhe um TIPO de decoração para cada ponto
// e o sistema sugere o checklist correspondente (as "tasks" que guiam o que o
// responsável deve observar no local). Os itens ficam editáveis antes de gerar
// o link e o snapshot é persistido em vistoria_pontos.itens (JSONB).
//
// Fonte única (front + relatório). O banco só guarda o JSON com as respostas.

export type CampoTipo = "texto" | "numero" | "check" | "select";

// Campo dentro de um item (ex.: Tensão/Fase, Gancho/Pitão, Quantidade, Tipo…).
export type CampoVT = {
  chave: string;
  label: string;
  tipo: CampoTipo;
  valor?: string; // texto/numero/select
  marcado?: boolean; // check
  opcoes?: string[]; // select
};

// Item do checklist de um ponto.
export type ItemVT = {
  chave: string;
  label: string;
  simNao: boolean; // exibe resposta Sim/Não
  resposta?: "sim" | "nao" | null;
  campos: CampoVT[];
};

export type TipoDecoracao = {
  chave: string;
  nome: string;
  descricao?: string;
  itens: ItemVT[];
};

// --- Blocos reutilizáveis ---------------------------------------------------

const pontoEletrico = (): ItemVT => ({
  chave: "ponto_eletrico",
  label: "Ponto elétrico no local",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "tensao", label: "Tensão", tipo: "texto", valor: "" },
    { chave: "fase", label: "Fase", tipo: "texto", valor: "" },
  ],
});

const fixacao = (): ItemVT => ({
  chave: "fixacao",
  label: "Ponto de fixação da decoração",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "gancho", label: "Gancho", tipo: "check", marcado: false },
    { chave: "pitao", label: "Pitão", tipo: "check", marcado: false },
    { chave: "cabo_aco", label: "Cabo de aço", tipo: "check", marcado: false },
  ],
});

const ancoragemVida = (): ItemVT => ({
  chave: "ancoragem_vida",
  label: "Ponto de ancoragem para linha de vida",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "cabo_aco", label: "Cabo de aço", tipo: "check", marcado: false },
  ],
});

const fachadaVidro = (): ItemVT => ({
  chave: "fachada_vidro",
  label: "Fachada em vidro ou ACM",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "borracha", label: "Borracha", tipo: "check", marcado: false },
    {
      chave: "macarrao",
      label: "Macarrão de piscina",
      tipo: "check",
      marcado: false,
    },
  ],
});

// Utilização de equipamentos — inclui "outro (descreva)".
const equipamentos = (): ItemVT => ({
  chave: "equipamentos",
  label: "Necessidade de equipamento",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "munck", label: "Munck", tipo: "check", marcado: false },
    { chave: "guindaste", label: "Guindaste", tipo: "check", marcado: false },
    { chave: "plataforma", label: "Plataforma", tipo: "check", marcado: false },
    { chave: "outro", label: "Outro (descreva)", tipo: "texto", valor: "" },
  ],
});

const estaiamento = (): ItemVT => ({
  chave: "estaiamento",
  label: "Estaiamento da decoração",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "ancoragem", label: "Ancoragem", tipo: "check", marcado: false },
    { chave: "contrapeso", label: "Contrapeso", tipo: "check", marcado: false },
  ],
});

const permissaoFurar = (): ItemVT => ({
  chave: "permissao_furar",
  label: "Permissão para furar",
  simNao: true,
  resposta: null,
  campos: [],
});

// Vegetação — levantamento (quantidade, tipo, altura média).
const vegetacaoLevantamento = (): ItemVT => ({
  chave: "vegetacao_levantamento",
  label: "Levantamento da vegetação",
  simNao: false,
  resposta: null,
  campos: [
    { chave: "quantidade", label: "Quantidade", tipo: "numero", valor: "" },
    {
      chave: "tipo",
      label: "Tipo",
      tipo: "select",
      valor: "",
      opcoes: ["Palmeira", "Árvore de galhos"],
    },
    { chave: "altura_media", label: "Altura média", tipo: "texto", valor: "" },
  ],
});

// Árvore de Natal — terreno.
const terrenoTipo = (): ItemVT => ({
  chave: "terreno_tipo",
  label: "Tipo de terreno",
  simNao: false,
  resposta: null,
  campos: [
    {
      chave: "tipo",
      label: "Terreno",
      tipo: "select",
      valor: "",
      opcoes: ["Terra", "Concreto", "Asfalto", "Paralelepípedo", "Outro"],
    },
  ],
});

const terrenoNivelado = (): ItemVT => ({
  chave: "terreno_nivelado",
  label: "Terreno nivelado",
  simNao: true,
  resposta: null,
  campos: [],
});

const acessoGuindaste = (): ItemVT => ({
  chave: "acesso_guindaste",
  label: "Acesso fácil para guindaste/munck",
  simNao: true,
  resposta: null,
  campos: [],
});

// Decoração interna.
const dimensoesPraca = (): ItemVT => ({
  chave: "dimensoes_praca",
  label: "Dimensões da praça",
  simNao: false,
  resposta: null,
  campos: [
    { chave: "medidas", label: "Medidas (C × L)", tipo: "texto", valor: "" },
  ],
});

const peDireito = (): ItemVT => ({
  chave: "pe_direito",
  label: "Altura do pé-direito",
  simNao: false,
  resposta: null,
  campos: [{ chave: "altura", label: "Altura", tipo: "texto", valor: "" }],
});

const decoracaoAerea = (): ItemVT => ({
  chave: "decoracao_aerea",
  label: "Decoração aérea",
  simNao: true,
  resposta: null,
  campos: [
    {
      chave: "fixacao",
      label: "Como são os pontos de fixação",
      tipo: "texto",
      valor: "",
    },
  ],
});

const acessoInstalacao = (): ItemVT => ({
  chave: "acesso_instalacao",
  label: "Acesso para instalação",
  simNao: false,
  resposta: null,
  campos: [
    { chave: "plataforma", label: "Plataforma", tipo: "check", marcado: false },
    { chave: "alpinista", label: "Alpinista", tipo: "check", marcado: false },
    { chave: "outro", label: "Outro (descreva)", tipo: "texto", valor: "" },
  ],
});

// --- Tipos de decoração -----------------------------------------------------

export const TIPOS_DECORACAO: TipoDecoracao[] = [
  {
    chave: "fachada",
    nome: "Fachada",
    descricao: "Fachadas em vidro/ACM e pórticos.",
    itens: [
      pontoEletrico(),
      fachadaVidro(),
      fixacao(),
      ancoragemVida(),
      estaiamento(),
      equipamentos(),
      permissaoFurar(),
    ],
  },
  {
    chave: "arvore_natal",
    nome: "Árvore de Natal",
    descricao: "Árvores e peças de grande porte com içamento.",
    itens: [
      pontoEletrico(),
      terrenoTipo(),
      terrenoNivelado(),
      acessoGuindaste(),
      fixacao(),
      ancoragemVida(),
      estaiamento(),
      equipamentos(),
      permissaoFurar(),
    ],
  },
  {
    chave: "vegetacao",
    nome: "Vegetação",
    descricao: "Rotatórias, jardins e árvores existentes.",
    itens: [
      pontoEletrico(),
      vegetacaoLevantamento(),
      fixacao(),
      ancoragemVida(),
      equipamentos(),
      estaiamento(),
      permissaoFurar(),
    ],
  },
  {
    chave: "pecas",
    nome: "Peças",
    descricao: "Peças e esculturas decorativas de solo.",
    itens: [
      pontoEletrico(),
      fixacao(),
      estaiamento(),
      equipamentos(),
      permissaoFurar(),
    ],
  },
  {
    chave: "decoracao_interna",
    nome: "Decoração interna",
    descricao: "Praças internas, decoração aérea e de piso.",
    itens: [
      dimensoesPraca(),
      peDireito(),
      pontoEletrico(),
      decoracaoAerea(),
      acessoInstalacao(),
      permissaoFurar(),
    ],
  },
  {
    chave: "outros",
    nome: "Outros",
    descricao: "Ocasiões específicas — checklist base editável.",
    itens: [
      pontoEletrico(),
      fixacao(),
      ancoragemVida(),
      estaiamento(),
      equipamentos(),
      permissaoFurar(),
    ],
  },
];

export function tipoPorChave(chave: string): TipoDecoracao | undefined {
  return TIPOS_DECORACAO.find((t) => t.chave === chave);
}

export function nomeTipo(chave: string | null | undefined): string {
  if (!chave) return "—";
  return tipoPorChave(chave)?.nome ?? chave;
}

// Cria uma cópia profunda dos itens de um tipo (para não compartilhar estado).
export function itensDoTipo(chave: string): ItemVT[] {
  const tipo = tipoPorChave(chave);
  if (!tipo) return [];
  return JSON.parse(JSON.stringify(tipo.itens)) as ItemVT[];
}

// --- Conferência inicial (uma vez por relatório) ----------------------------

export type Conferencia = {
  deposito: string; // altura x largura x comprimento
  iluminacao: "sim" | "nao" | null;
  ponto_eletrico: "sim" | "nao" | null;
  tensao: string;
  fase: string;
  risco: "sim" | "nao" | null;
  porta_deposito: string;
  porta_entrada: string;
  rotas_acesso: string;
};

export function conferenciaVazia(): Conferencia {
  return {
    deposito: "",
    iluminacao: null,
    ponto_eletrico: null,
    tensao: "",
    fase: "",
    risco: null,
    porta_deposito: "",
    porta_entrada: "",
    rotas_acesso: "",
  };
}
