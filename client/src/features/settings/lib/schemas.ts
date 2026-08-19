import { z } from "zod";

export const pwSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "Must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const profileSchema = z.object({
  phone: z.string().optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
});

export type PwForm = z.infer<typeof pwSchema>;
export type ProfileForm = z.infer<typeof profileSchema>;
