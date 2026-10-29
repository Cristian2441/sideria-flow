import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Email inválido" })),
  password: z
    .string()
    .min(1, { error: "La contraseña es requerida" })
    .max(72, { error: "Contraseña inválida" }),
});


export type LoginInput = z.infer<typeof loginSchema>;
