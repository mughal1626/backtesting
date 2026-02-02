import React from "react";

export function WindowFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black p-6 text-gray-100">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="mb-10 text-center text-3xl font-semibold tracking-wide text-white/90">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}
