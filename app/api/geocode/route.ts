export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Geocodificação reversa (coordenada -> endereço) via OpenStreetMap Nominatim.
// Feita no servidor para não expor o cliente a CORS/limites e para enviar um
// User-Agent identificável (política de uso do Nominatim). Degrada com
// elegância: qualquer falha responde { endereco: null } (a foto ainda recebe
// coordenadas + data/hora no carimbo do cliente).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return Response.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
      `&zoom=18&addressdetails=1&accept-language=pt-BR`;

    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "FabricaDeLuzOS/1.0 (https://fabricadeluz.com.br; gestao@fabricadeluz.com.br)",
        Accept: "application/json",
      },
      // Nominatim pode demorar; não deixamos o upload travar por causa disso.
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      return Response.json({ endereco: null });
    }

    const data = (await resp.json()) as { display_name?: string };
    const endereco =
      typeof data?.display_name === "string" ? data.display_name : null;

    return Response.json({ endereco });
  } catch {
    return Response.json({ endereco: null });
  }
}
