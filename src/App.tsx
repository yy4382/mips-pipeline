import { PipelineComp } from "./components/5stage/pipeline";
import { Toaster } from "@/components/ui/sonner";
import { buttonVariants } from "./components/ui/button";
import { BrowserRouter, Route, Routes, Link } from "react-router";
import { TomasuloComp } from "./components/tomasulo/tomasulo";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<Mips5StageApp />}></Route>
        <Route path="/tomasulo" element={<TomasuloApp />}></Route>
      </Routes>
      <Toaster toastOptions={{ duration: 10000 }} visibleToasts={20} />
    </BrowserRouter>
  );
}

function Mips5StageApp() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <header className="mb-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100">
              MIPS Pipeline Simulator
            </h1>
            <p className="text-center text-slate-500 dark:text-slate-400 mt-2 mb-4">
              Visual representation of a MIPS pipeline with hazard detection
              <br />A course project, NOT ACTUALLY MIPS COMPATIBLE!
            </p>
            <div className="flex justify-center gap-4 mt-2">
              <a
                href="https://github.com/yy4382/mips-pipeline"
                className={buttonVariants({ variant: "outline" })}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
              <Link
                to="/tomasulo"
                className={buttonVariants({ variant: "default" })}
              >
                Go to Tomasulo Simulator
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <PipelineComp />
      </main>
    </div>
  );
}

function TomasuloApp() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <header className="mb-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100">
              Tomasulo Algorithm Simulator
            </h1>
            <p className="text-center text-slate-500 dark:text-slate-400 mt-2 mb-4">
              Course project.
            </p>
            <div className="flex justify-center gap-4 mt-2">
              <a
                href="https://github.com/yy4382/mips-pipeline"
                className={buttonVariants({ variant: "outline" })}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
              <Link to="/" className={buttonVariants({ variant: "default" })}>
                Back to Pipeline Simulator
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <TomasuloComp />
      </main>
    </div>
  );
}

export default App;
