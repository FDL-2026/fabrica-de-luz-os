// Correspondência tolerante entre os nomes que vêm no cronograma (Excel) e os
// usuários cadastrados no sistema. O nome no cronograma costuma vir abreviado
// ou parcial — "Koga" em vez de "Bruno Koga", "Lucas" em vez de "Lucas Borges".
// Estas funções resolvem esses casos de forma conservadora: só retornam um
// vínculo quando há um vencedor único e com confiança suficiente, evitando
// associar o projeto ao gestor errado.

export type UsuarioVinculo = {
  usuario_id: string;
  nome: string | null;
  perfil: string | null;
};

// Palavras que não ajudam a identificar uma pessoa (conectores e rótulos comuns
// de coluna "Equipe"/"Responsável"). São ignoradas na comparação.
const PALAVRAS_IGNORADAS = new Set([
  "equipe",
  "equipes",
  "time",
  "montador",
  "montadores",
  "gestor",
  "responsavel",
  "sr",
  "sra",
  "de",
  "da",
  "do",
  "dos",
  "das",
  "e",
]);

// Remove acentos, baixa a caixa, tira pontuação e colapsa espaços.
export function normalizarNome(valor: string | null | undefined): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavras(nomeNorm: string): string[] {
  return nomeNorm.split(" ").filter((parte) => parte.length >= 2);
}

// Pontua o quanto o texto do cronograma (`alvoNorm`) corresponde ao nome
// cadastrado (`nomeNorm`). Quanto maior, mais forte a correspondência.
export function pontuarCorrespondencia(
  alvoNorm: string,
  nomeNorm: string
): number {
  if (!alvoNorm || !nomeNorm) return 0;
  if (alvoNorm === nomeNorm) return 1000;

  const alvoWords = palavras(alvoNorm);
  const nomeWords = palavras(nomeNorm);

  if (alvoWords.length === 0 || nomeWords.length === 0) return 0;

  const nomeSet = new Set(nomeWords);
  const relevantes = alvoWords.filter((w) => !PALAVRAS_IGNORADAS.has(w));
  const base = relevantes.length > 0 ? relevantes : alvoWords;

  // Todas as palavras relevantes do cronograma existem no nome cadastrado.
  // Ex.: "koga" ⊆ {bruno, koga}; "lucas" ⊆ {lucas, borges}.
  const todasPresentes = base.every((w) => nomeSet.has(w));
  if (todasPresentes) return 500 + base.length * 60;

  // Sobreposição parcial: o nome cadastrado é citado dentro do texto.
  const compartilhadas = nomeWords.filter(
    (w) => !PALAVRAS_IGNORADAS.has(w) && base.includes(w)
  );
  if (compartilhadas.length > 0) return 150 * compartilhadas.length;

  return 0;
}

// Resolve um texto do cronograma para um único usuário candidato.
// Retorna null quando não há confiança suficiente ou quando há empate
// (dois candidatos igualmente prováveis), para nunca vincular errado.
export function resolverUsuario(
  textoCronograma: string | null | undefined,
  candidatos: UsuarioVinculo[],
  limiar = 400
): UsuarioVinculo | null {
  const alvo = normalizarNome(textoCronograma);
  if (!alvo) return null;

  let melhor: UsuarioVinculo | null = null;
  let melhorScore = 0;
  let segundoScore = 0;

  for (const candidato of candidatos) {
    const score = pontuarCorrespondencia(alvo, normalizarNome(candidato.nome));

    if (score > melhorScore) {
      segundoScore = melhorScore;
      melhor = candidato;
      melhorScore = score;
    } else if (score > segundoScore) {
      segundoScore = score;
    }
  }

  if (melhor && melhorScore >= limiar && melhorScore > segundoScore) {
    return melhor;
  }

  return null;
}

// Descobre quais montadores estão citados num texto de "Equipe" — que pode
// conter mais de um nome (ex.: "Marcos e Judson"). Um montador é considerado
// citado quando qualquer palavra distintiva (>= 3 letras) do seu nome aparece
// no texto da equipe. Retorna a lista sem duplicatas.
export function montadoresNaEquipe(
  textoEquipe: string | null | undefined,
  montadores: UsuarioVinculo[]
): UsuarioVinculo[] {
  const equipeNorm = normalizarNome(textoEquipe);
  if (!equipeNorm) return [];

  const equipeSet = new Set(
    palavras(equipeNorm).filter((w) => !PALAVRAS_IGNORADAS.has(w))
  );
  if (equipeSet.size === 0) return [];

  const encontrados: UsuarioVinculo[] = [];

  for (const montador of montadores) {
    const nomeWords = palavras(normalizarNome(montador.nome)).filter(
      (w) => w.length >= 3 && !PALAVRAS_IGNORADAS.has(w)
    );

    if (nomeWords.some((w) => equipeSet.has(w))) {
      encontrados.push(montador);
    }
  }

  return encontrados;
}
