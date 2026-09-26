import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

// useSearchParams() (para leer ?token=) obliga en Next 14 a envolver el
// componente en un Suspense boundary, si no el build falla.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
