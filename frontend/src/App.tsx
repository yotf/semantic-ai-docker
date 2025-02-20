import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SearchInterface } from "./components/SearchInterface";
import { ThemeProvider } from "./components/theme-provider";
import { ModeToggle } from "./components/mode-toggle";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <div className="min-h-screen bg-blue-grey-50 dark:bg-blue-grey-900  text-blue-grey-900 dark:text-blue-grey-50">
          <div className="container mx-auto py-8">
            <div className="flex justify-between mb-8">
              <h1 className="text-3xl font-bold ">Scholar Search</h1>{" "}
              <ModeToggle />
            </div>
            <SearchInterface />
          </div>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
