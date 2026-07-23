// Carimba uma foto (no cliente, via canvas) com data/hora, coordenadas e — se
// disponível — endereço, gravados por cima da imagem antes do upload. Usado
// pelo montador ao registrar fotos de "antes/depois" do atendimento de chamados.

export type GeoInfo = {
  lat: number;
  lng: number;
  precisao: number | null;
};

// Pede a localização do aparelho. Resolve null se o usuário negar, não houver
// GPS, ou estourar o tempo — nunca rejeita, para não travar a captura.
export function obterLocalizacao(timeoutMs = 8000): Promise<GeoInfo | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

async function buscarEndereco(lat: number, lng: number): Promise<string | null> {
  try {
    const resp = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    if (!resp.ok) return null;
    const json = (await resp.json()) as { endereco?: string | null };
    return typeof json?.endereco === "string" ? json.endereco : null;
  } catch {
    return null;
  }
}

async function carregarImagem(
  file: File
): Promise<{ fonte: CanvasImageSource; largura: number; altura: number } | null> {
  // createImageBitmap respeita a orientação EXIF (foto de celular não sai
  // deitada) e é mais eficiente. Cai para <img> se não houver suporte.
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    return { fonte: bitmap, largura: bitmap.width, altura: bitmap.height };
  } catch {
    // fallback
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ fonte: img, largura: img.naturalWidth, altura: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// Quebra o endereço em linhas que caibam na largura do canvas.
function quebrarLinhas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  larguraMax: number
): string[] {
  const palavras = texto.split(" ");
  const linhas: string[] = [];
  let atual = "";

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > larguraMax && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// Recebe o arquivo da câmera e devolve um novo arquivo JPEG com o carimbo.
// Se algo falhar (sem canvas, imagem ilegível), devolve o arquivo original.
export async function carimbarFoto(file: File): Promise<File> {
  if (typeof document === "undefined") return file;

  const [geo, imagem] = await Promise.all([
    obterLocalizacao(),
    carregarImagem(file),
  ]);

  if (!imagem) return file;

  const endereco = geo ? await buscarEndereco(geo.lat, geo.lng) : null;
  const agora = new Date();

  // Limita a largura para conter o tamanho do upload.
  const larguraMax = 1600;
  const escala = imagem.largura > larguraMax ? larguraMax / imagem.largura : 1;
  const cw = Math.round(imagem.largura * escala);
  const ch = Math.round(imagem.altura * escala);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(imagem.fonte, 0, 0, cw, ch);

  const fontSize = Math.max(14, Math.round(cw * 0.028));
  const padding = Math.round(fontSize * 0.7);
  const lineHeight = Math.round(fontSize * 1.35);
  ctx.font = `${fontSize}px system-ui, -apple-system, Arial, sans-serif`;
  ctx.textBaseline = "top";

  const larguraTexto = cw - padding * 2;
  const linhas: string[] = [];

  linhas.push(
    agora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })
  );

  if (geo) {
    linhas.push(
      `Lat ${geo.lat.toFixed(6)}  Long ${geo.lng.toFixed(6)}` +
        (geo.precisao ? `  (±${Math.round(geo.precisao)} m)` : "")
    );
  } else {
    linhas.push("Localização indisponível");
  }

  if (endereco) {
    for (const linha of quebrarLinhas(ctx, endereco, larguraTexto)) {
      linhas.push(linha);
    }
  }

  const boxH = padding * 2 + lineHeight * linhas.length;

  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, ch - boxH, cw, boxH);

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 2;
  linhas.forEach((linha, i) => {
    ctx.fillText(linha, padding, ch - boxH + padding + i * lineHeight);
  });
  ctx.shadowBlur = 0;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );

  if (!blob) return file;

  const baseNome = (file.name || "foto").replace(/\.[^.]+$/, "");
  return new File([blob], `${baseNome}-carimbada.jpg`, { type: "image/jpeg" });
}
