// pages/index.js
import ScriptRunner from "../components/ScriptRunner";
import "./pages/index.css";

export default function Home() {
  return (
    <div>
      <h1 style={{ textAlign: "left" }}>Surus Utilities</h1>
      <ScriptRunner />
    </div>
  );
}
