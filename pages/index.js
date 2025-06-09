import Head from "next/head";
import ScriptRunner from "../components/ScriptRunner";

export default function Home() {
  return (
    <div>
      <Head>
        <title>Surus Utilties</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ScriptRunner />
    </div>
  );
}

// test
