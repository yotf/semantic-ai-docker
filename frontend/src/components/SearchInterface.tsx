import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import QuerySuggestion from "./QuerySuggestion";
import ResultsTable from "./ResultsTable";
import SearchMetrics from "./SearchMetrics";
import ButtonWithTooltip from "./ui/button-with-tooltip";
import DatePicker from "./ui/date-picker";
import { Separator } from "./ui/separator";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface SearchParams {
  pubmed_query: string;
  semantic_query: string;
  date_start: string;
  date_end: string;
}

export interface Paper {
  title: string;
  year: number;
  authors: string[];
  abstract: string;
  url: string;
  citation_count: number;
  pdf_url?: string;
}

export interface SearchResponse {
  semantic_scholar_results: number;
  pubmed_results: number;
  unique_to_pubmed: number;
  unique_to_semantic: number;
  duplicate_count: number;
  papers: Paper[];
  search_id: string;
}
const extractDatesFromPubMedQuery = (
  query: string
): { start: string | null; end: string | null } => {
  // Match both quoted and unquoted dates, and single/double digit months/days
  const datePattern =
    /(\d{4}\/\d{1,2}\/\d{1,2}):(\d{4}\/\d{1,2}\/\d{1,2})\[pdat\]/;
  const match = query.match(datePattern);

  if (match) {
    // Convert dates to YYYY-MM-DD format with padded months and days
    const formatDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split("/");
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    };

    const startDate = formatDate(match[1]);
    const endDate = formatDate(match[2]);

    console.log("Extracted dates:", { startDate, endDate }); // For debugging
    return { start: startDate, end: endDate };
  }

  return { start: null, end: null };
};

export function SearchInterface() {
  const [searchParams, setSearchParams] = useState<SearchParams>({
    pubmed_query: "",
    semantic_query: "",
    date_start: "2020-01-01",
    date_end: "2024-12-31",
  });
  const [highlightDates, setHighlightDates] = useState(false);
  const [highlightSemantic, setHighlightSemantic] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<SearchResponse>({
    queryKey: ["search", searchParams],
    queryFn: async () => {
      const response = await axios.post(`${API_URL}/api/search`, searchParams);
      return response.data;
    },
    enabled: false,
  });

  const handleSearch = () => {
    refetch();
  };

  const exportMutation = useMutation({
    mutationFn: async (searchId: string) => {
      const response = await axios.get(`${API_URL}/api/export/${searchId}`, {
        responseType: "blob",
      });
      return response.data;
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0];
      const filename = `search_results_${timestamp}.xlsx`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    onError: (error) => {
      console.error("Export failed:", error);
    },
  });

  const handleExport = async () => {
    if (!data?.search_id) {
      console.error("No search ID available");
      return;
    }

    exportMutation.mutate(data.search_id);
  };

  const isDisabled =
    isLoading || !searchParams.pubmed_query || !searchParams.semantic_query;
  const validationMessage =
    !searchParams.pubmed_query && !searchParams.semantic_query
      ? "Please enter both PubMed and Semantic Scholar queries"
      : !searchParams.pubmed_query
      ? "Please enter a PubMed query"
      : !searchParams.semantic_query
      ? "Please enter a Semantic Scholar query"
      : "";

  return (
    <div className="space-y-8 ">
      <Card>
        <CardHeader>
          <CardTitle>Search Parameters</CardTitle>
          {/* <CardDescription>
            Enter your search query and date range
          </CardDescription> */}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pubmed_query">PubMed Search Query</Label>
            <Input
              id="pubmed_query"
              value={searchParams.pubmed_query}
              onChange={(e) => {
                const query = e.target.value;
                const dates = extractDatesFromPubMedQuery(query);
                if (dates.start || dates.end) {
                  setHighlightDates(true);
                  setTimeout(() => setHighlightDates(false), 2000);
                }

                setSearchParams((prev) => ({
                  ...prev,
                  pubmed_query: query,
                  // Only update dates if found in query
                  ...(dates.start && { date_start: dates.start }),
                  ...(dates.end && { date_end: dates.end }),
                }));
              }}
              placeholder="Enter PubMed query (e.g., cancer[Title/Abstract] AND therapy)"
              required
            />
            <QuerySuggestion
              pubmedQuery={searchParams.pubmed_query}
              onAccept={(suggestedQuery) => {
                setSearchParams((prev) => ({
                  ...prev,
                  semantic_query: suggestedQuery,
                }));
                setHighlightSemantic(true);
                setTimeout(() => setHighlightSemantic(false), 2000);
              }}
            />
            {/* <p className="text-sm text-muted-foreground">
              Enter your search query in PubMed format
            </p> */}
          </div>

          <Separator orientation="horizontal" className="" />
          {/* <div className="border border-blue-grey-300 dark:border-blue-grey-600 p-4 rounded-md flex flex-col gap-4"> */}
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="semantic_query">
                Semantic Scholar Search Query
              </Label>
              <div
                className={cn(
                  "transition-all duration-300",
                  highlightSemantic &&
                    "ring-2 ring-pink-vivid-400/50 rounded-md"
                )}
              >
                <Input
                  id="semantic_query"
                  value={searchParams.semantic_query}
                  onChange={(e) =>
                    setSearchParams((prev) => ({
                      ...prev,
                      semantic_query: e.target.value,
                    }))
                  }
                  placeholder="Enter Semantic Scholar query (e.g., cancer + therapy)"
                  required
                />
              </div>
              {/* <p className="text-sm text-muted-foreground">
              Enter your search query in Semantic Scholar format. Use + for AND,
              | for OR.
            </p> */}
            </div>
            <div className="flex gap-4 ">
              <div className="flex flex-col gap-2">
                <Label>Start Date</Label>
                <div
                  className={cn(
                    "transition-all duration-300",
                    highlightDates && "ring-2 ring-pink-vivid-400/50 rounded-md"
                  )}
                >
                  <DatePicker
                    value={new Date(searchParams.date_start)}
                    onSelect={(date) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        date_start: date.toISOString().split("T")[0],
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>End Date</Label>
                <div
                  className={cn(
                    "transition-all duration-300",
                    highlightDates && "ring-2 ring-pink-vivid-400/50 rounded-md"
                  )}
                >
                  <DatePicker
                    value={new Date(searchParams.date_end)}
                    onSelect={(date) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        date_end: date.toISOString().split("T")[0],
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <ButtonWithTooltip
            onClick={handleSearch}
            disabled={isDisabled}
            tooltipContent={validationMessage}
            showTooltip={isDisabled}
            className="w-full"
          >
            {isLoading ? "Searching..." : "Search"}
          </ButtonWithTooltip>
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-red-vivid-50 border-red-vivid-200">
          <CardContent className="pt-6">
            <p className="text-red-vivid-700">
              Error: {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-8">
          <SearchMetrics data={data} />
          <ResultsTable data={data} onExport={handleExport} />
        </div>
      )}
    </div>
  );
}
