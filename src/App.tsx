import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center font-sans p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">Git Rewriter</h1>
          <p className="text-neutral-400 text-sm">Minimalist history editor</p>
        </div>

        <form
          className="flex flex-col gap-4 mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            greet();
          }}
        >
          <input
            id="greet-input"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-neutral-600 transition-colors"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter a repository path..."
          />
          <button 
            type="submit"
            className="w-full bg-white text-black font-medium rounded-md px-4 py-2 text-sm hover:bg-neutral-200 transition-colors"
          >
            Open Repository
          </button>
        </form>
        {greetMsg && (
          <p className="text-center text-sm text-neutral-400 mt-4">{greetMsg}</p>
        )}
      </div>
    </main>
  );
}

export default App;
