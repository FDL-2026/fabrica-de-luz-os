// Renderiza o relatório da vistoria em HTML com estilos inline (compatível
// tanto com a visualização na tela quanto com o export .doc do Word).
// Fonte única para os dois formatos: a única diferença é como cada foto é
// referenciada (URL do proxy na tela; data URI base64 no Word).

import { nomeTipo, type CampoVT, type ItemVT } from "./templates";

type Foto = { external_file_id: string | null; categoria?: string | null };

type Ponto = {
  nome: string;
  tipo: string;
  itens: ItemVT[] | null;
  anotacoes: string | null;
  fotos: Foto[] | null;
};

type Local = {
  nome: string;
  endereco: string | null;
  pontos: Ponto[] | null;
};

export type VistoriaRelatorio = {
  titulo: string | null;
  projeto_nome: string | null;
  eng_responsavel: string | null;
  data_prevista: string | null;
  status: string | null;
  preenchido_por_nome: string | null;
  acompanhante_nome: string | null;
  acompanhante_contato: string | null;
  acompanhante_area: string | null;
  concluida_em: string | null;
  conferencia: Record<string, unknown> | null;
  locais: Local[];
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataBR(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return esc(v);
  return d.toLocaleDateString("pt-BR", { dateStyle: "short" });
}

function simNaoTxt(v: unknown): string {
  if (v === "sim") return "Sim";
  if (v === "nao") return "Não";
  return "—";
}

const COR_ROXO = "#3a2456";
const COR_LINHA = "#d9d2e6";

function linhaTabela(rotulo: string, valor: string): string {
  return `<tr>
    <td style="border:1px solid ${COR_LINHA};padding:6px 10px;font-weight:bold;background:#f4f1fa;width:34%;">${esc(
      rotulo
    )}</td>
    <td style="border:1px solid ${COR_LINHA};padding:6px 10px;">${valor || "—"}</td>
  </tr>`;
}

function renderCampos(campos: CampoVT[]): string {
  const partes = campos
    .map((c) => {
      if (c.tipo === "check") {
        return c.marcado ? `<strong>${esc(c.label)}</strong> ✓` : "";
      }
      return c.valor && c.valor.trim()
        ? `${esc(c.label)}: ${esc(c.valor)}`
        : "";
    })
    .filter(Boolean);
  return partes.join(" &nbsp;·&nbsp; ");
}

function renderItem(it: ItemVT): string {
  const camposHtml = renderCampos(it.campos ?? []);
  return `<tr>
    <td style="border:1px solid ${COR_LINHA};padding:5px 10px;">${esc(
      it.label
    )}</td>
    <td style="border:1px solid ${COR_LINHA};padding:5px 10px;text-align:center;width:70px;font-weight:bold;">${
      it.simNao ? simNaoTxt(it.resposta) : "—"
    }</td>
    <td style="border:1px solid ${COR_LINHA};padding:5px 10px;color:#444;">${
      camposHtml || "—"
    }</td>
  </tr>`;
}

function renderPonto(
  p: Ponto,
  fotoSrc: (fileId: string) => string | null
): string {
  const itens = (p.itens ?? [])
    .map(renderItem)
    .join("");

  const galeria = (lista: Foto[], titulo: string): string => {
    const imgs = lista
      .map((f) => (f.external_file_id ? fotoSrc(f.external_file_id) : null))
      .filter((src): src is string => Boolean(src))
      .map(
        (src) =>
          `<img src="${src}" alt="${esc(
            titulo
          )}" style="width:180px;height:135px;object-fit:cover;border:1px solid ${COR_LINHA};margin:0 6px 6px 0;border-radius:4px;" />`
      )
      .join("");
    if (!imgs) return "";
    return `<p style="margin:8px 0 2px;font-size:12px;font-weight:bold;color:${COR_ROXO};">${esc(
      titulo
    )}</p><div>${imgs}</div>`;
  };

  const todas = p.fotos ?? [];
  const fotos =
    galeria(
      todas.filter((f) => f.categoria === "referencia"),
      "Referência — onde instalar"
    ) +
    galeria(
      todas.filter((f) => f.categoria !== "referencia"),
      "Registros in loco"
    );

  return `<div style="margin-top:22px;page-break-inside:avoid;">
    <h3 style="margin:0 0 2px;color:${COR_ROXO};font-size:15px;">${esc(
      p.nome
    )} <span style="font-weight:normal;color:#888;font-size:12px;">— ${esc(
      nomeTipo(p.tipo)
    )}</span></h3>
    <table style="border-collapse:collapse;width:100%;font-size:12px;margin-top:6px;">
      <thead>
        <tr>
          <th style="border:1px solid ${COR_LINHA};padding:5px 10px;text-align:left;background:${COR_ROXO};color:#fff;">Item</th>
          <th style="border:1px solid ${COR_LINHA};padding:5px 10px;background:${COR_ROXO};color:#fff;">Situação</th>
          <th style="border:1px solid ${COR_LINHA};padding:5px 10px;text-align:left;background:${COR_ROXO};color:#fff;">Detalhes</th>
        </tr>
      </thead>
      <tbody>${itens || `<tr><td colspan="3" style="border:1px solid ${COR_LINHA};padding:8px;color:#888;">Sem itens.</td></tr>`}</tbody>
    </table>
    ${
      p.anotacoes && p.anotacoes.trim()
        ? `<p style="margin:8px 0 0;font-size:12px;"><strong>Anotações:</strong> ${esc(
            p.anotacoes
          )}</p>`
        : ""
    }
    ${fotos ? `<div style="margin-top:8px;">${fotos}</div>` : ""}
  </div>`;
}

function renderConferencia(c: Record<string, unknown> | null): string {
  const conf = c ?? {};
  const pontoEletrico =
    conf.ponto_eletrico === "sim"
      ? `Sim${conf.tensao ? ` · Tensão: ${esc(conf.tensao)}` : ""}${
          conf.fase ? ` · Fase: ${esc(conf.fase)}` : ""
        }`
      : simNaoTxt(conf.ponto_eletrico);

  return `<h2 style="margin:22px 0 6px;color:${COR_ROXO};font-size:16px;border-bottom:2px solid ${COR_ROXO};padding-bottom:4px;">Conferência inicial</h2>
  <table style="border-collapse:collapse;width:100%;font-size:12px;">
    <tbody>
      ${linhaTabela("Tamanho do depósito (A × L × C)", esc(conf.deposito))}
      ${linhaTabela("Iluminação no local", simNaoTxt(conf.iluminacao))}
      ${linhaTabela("Ponto elétrico no local", pontoEletrico)}
      ${linhaTabela("Risco de molhar, sujar etc.", simNaoTxt(conf.risco))}
      ${linhaTabela("Dimensões da porta do depósito", esc(conf.porta_deposito))}
      ${linhaTabela("Porta de entrada dos materiais", esc(conf.porta_entrada))}
      ${linhaTabela("Rotas de acesso", esc(conf.rotas_acesso))}
    </tbody>
  </table>`;
}

// Corpo do relatório (sem <html>/<head>). fotoSrc devolve a URL/data-URI de
// cada foto, ou null para omiti-la.
export function relatorioVistoriaBody(
  v: VistoriaRelatorio,
  fotoSrc: (fileId: string) => string | null
): string {
  const cabecalho = `<div style="border-bottom:3px solid ${COR_ROXO};padding-bottom:10px;margin-bottom:14px;">
    <p style="margin:0;letter-spacing:2px;text-transform:uppercase;color:#8a7bb0;font-size:11px;">Relatório de Vistoria Técnica</p>
    <h1 style="margin:4px 0 0;color:${COR_ROXO};font-size:22px;">${esc(
      v.titulo
    )}</h1>
  </div>`;

  const acomp = [v.acompanhante_nome, v.acompanhante_area, v.acompanhante_contato]
    .filter((x) => x && String(x).trim())
    .map((x) => esc(x))
    .join(" · ");

  const cabecalhoTabela = `<table style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:6px;">
    <tbody>
      ${linhaTabela("Projeto", esc(v.projeto_nome || v.titulo))}
      ${linhaTabela("Eng. responsável", esc(v.eng_responsavel))}
      ${linhaTabela("Data prevista", dataBR(v.data_prevista))}
      ${linhaTabela(
        "Status",
        v.status === "concluida"
          ? `Concluída em ${dataBR(v.concluida_em)}`
          : "Aguardando preenchimento"
      )}
      ${linhaTabela("Preenchida por", esc(v.preenchido_por_nome))}
      ${acomp ? linhaTabela("Acompanhante", acomp) : ""}
    </tbody>
  </table>`;

  const conferencia = renderConferencia(v.conferencia);

  const locais = (v.locais ?? [])
    .map((local, i) => {
      const pontos = (local.pontos ?? [])
        .map((p) => renderPonto(p, fotoSrc))
        .join("");
      return `<div style="margin-top:24px;page-break-inside:avoid;">
        <h2 style="margin:0 0 2px;color:${COR_ROXO};font-size:16px;border-bottom:2px solid ${COR_ROXO};padding-bottom:4px;">
          Local ${i + 1}: ${esc(local.nome)}
        </h2>
        ${
          local.endereco && local.endereco.trim()
            ? `<p style="margin:4px 0 0;font-size:12px;color:#555;">${esc(
                local.endereco
              )}</p>`
            : ""
        }
        ${pontos}
      </div>`;
    })
    .join("");

  const secaoLocais = `<h2 style="margin:24px 0 0;color:${COR_ROXO};font-size:16px;">Locais vistoriados</h2>${locais}`;

  return `${cabecalho}${cabecalhoTabela}${conferencia}${secaoLocais}`;
}

// Documento .doc completo (Word abre HTML como Word).
export function relatorioVistoriaDoc(
  v: VistoriaRelatorio,
  fotoSrc: (fileId: string) => string | null
): string {
  const body = relatorioVistoriaBody(v, fotoSrc);
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${esc(v.titulo)}</title>
<style>
  @page { size: A4; margin: 1.6cm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color:#222; }
</style>
</head>
<body>${body}</body>
</html>`;
}
