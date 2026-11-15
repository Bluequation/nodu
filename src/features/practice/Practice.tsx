import { Navigate } from "react-router-dom";

export { ErrorsPage } from "./ErrorsPage";

/** Keeps old links working while directing all question practice to the unified notebook. */
export function QuestionsPage() {
  return <Navigate to="/errors?view=performance" replace />;
}
