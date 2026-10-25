export type ImportField =
  | "name"
  | "subdomain"
  | "description"
  | "theme"
  | "primaryColor";

export type ImportFormState = {
  error: { field: ImportField | "form"; message: string } | null;
};

export const initialImportFormState: ImportFormState = { error: null };
