// pages/index.js
import ScriptRunner from "../components/ScriptRunner";

export default function Home() {
  return (
    <div>
      <Head>
        <title>Surus Utilities</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <h1 style={{ textAlign: "left" }}>Surus Utilities</h1>
      <ScriptRunner />
    </div>
  );
}
