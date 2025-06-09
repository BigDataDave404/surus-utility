// pages/index.js
import ScriptRunner from "../components/ScriptRunner";

export default function Home() {
  return (
    <div>
      <head>
        <title>Surus Utilities</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />  
      </head>
      <h1 style={{ textAlign: "left" }}>Surus Utilities</h1>
      <ScriptRunner />
    </div>
  );
}
