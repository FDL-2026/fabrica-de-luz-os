"use client";

import { useEffect, useState } from "react";
import RegistrarManutencao from "@/components/manutencao/registrar-manutencao";

// Wrapper do montador: lê a sessão por PIN (localStorage) e injeta o usuarioId
// no formulário de registro de manutenção reutilizável.
export default function RegistrarManutencaoMontador({
  codigo,
  projetoId,
}: {
  codigo: string;
  projetoId: string;
}) {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storage = localStorage.getItem("fdl_montador");
      if (!storage) return;
      const dados = JSON.parse(storage);
      if (
        dados?.usuarioId &&
        dados?.codigo?.toUpperCase() === codigo.toUpperCase()
      ) {
        setUsuarioId(dados.usuarioId as string);
      }
    } catch {
      // sessão inválida: apenas não mostra o registro
    }
  }, [codigo]);

  if (!usuarioId) return null;

  return <RegistrarManutencao projetoId={projetoId} usuarioId={usuarioId} />;
}
