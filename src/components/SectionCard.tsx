import React from "react";

export function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_0_20px_rgba(0,0,0,0.3)]",
        "backdrop-blur-md",
        className,
      ].join(" ")}
    >
      <h2 className="mb-4 text-2xl font-semibold text-white/90">{title}</h2>
      {children}
    </section>
  );
}
