
  import { createRoot } from "react-dom/client";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import "./lib/i18n";
  import { initTelemetry } from "./lib/telemetry";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  // Lazy-loads PostHog only when the citizen has previously opted in.
  // No-op otherwise — keeps the page clean of third-party SDKs by default.
  initTelemetry();

  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
  
