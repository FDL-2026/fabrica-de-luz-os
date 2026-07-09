"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type BrandLogoProps = {
  className?: string;
};

// Logo que se adapta ao tema: no escuro usa a versão creme (sem fundo);
// no claro usa a versão em bloco roxo, que permanece legível sobre o claro.
export default function BrandLogo({ className }: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const light = mounted && resolvedTheme === "light";
  const src = light
    ? "/brand/H_TAGLINE_SF_BEGE.png"
    : "/brand/H_TAGLINE_SF_ROXO.png";

  return (
    <Image
      src={src}
      alt="Fábrica de Luz"
      width={500}
      height={300}
      priority
      className={className}
    />
  );
}
