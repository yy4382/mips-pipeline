import { PipelineComp } from "./components/pipeline";
import { Toaster } from "@/components/ui/sonner";
import { buttonVariants } from "./components/ui/button";

function App() {
  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
        <header className="mb-8">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-slate-100">
              MIPS Pipeline Simulator
            </h1>
            <p className="text-center text-slate-500 dark:text-slate-400 mt-2">
              Visual representation of a MIPS pipeline with hazard detection
              <br />A course project, NOT ACTUALLY MIPS COMPATIBLE!
              <br />
              <a
                href="https://github.com/yy4382/mips-pipeline"
                className={buttonVariants({ variant: "link" })}
              >
                GitHub
              </a>
            </p>
          </div>
        </header>

        <main className="container mx-auto px-4">
          <PipelineComp />
        </main>
      </div>
      <Toaster toastOptions={{ duration: 10000 }} />
    </>
  );
}

export default App;
