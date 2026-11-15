import { Navigate } from "react-router-dom";

export { ErrorsPage } from "./ErrorsPage";

/** Keeps old links working by routing them to the single error notebook. */
export function QuestionsPage() {
  return <Navigate to="/errors" replace />;
}
