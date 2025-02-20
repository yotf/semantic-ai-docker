import React from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check } from "lucide-react";

interface QuerySuggestionProps {
  pubmedQuery: string;
  onAccept: (query: string) => void;
}
const translateQuery = (query: string) => {
  if (!query) return "";

  // Remove field specifications

  let translatedQuery = query.replace(/\[Title\/Abstract\]/g, "");

  // Remove date restrictions with the full date pattern, including surrounding parentheses
  translatedQuery = translatedQuery
    // Remove date sections with parentheses
    .replace(
      /\s*\(?AND\s*\(?\d{4}\/\d{1,2}\/\d{1,2}:\d{4}\/\d{1,2}\/\d{1,2}\[pdat\]\)?\s*/g,
      ""
    )
    // Remove standalone date sections
    .replace(
      /\s*\(?\d{4}\/\d{1,2}\/\d{1,2}:\d{4}\/\d{1,2}\/\d{1,2}\[pdat\]\)?\s*/g,
      ""
    );

  // Remove any remaining [pdat] sections
  translatedQuery = translatedQuery.replace(/\[pdat\]/g, "");

  // Clean up any trailing operators
  translatedQuery = translatedQuery.replace(/\s+(AND|OR)\s*$/g, "");

  // Replace operators (preserve quoted strings)
  const preserveQuotes = (str: string) => {
    const quotes: string[] = [];
    let cleaned = str.replace(/"[^"]+"/g, (match) => {
      quotes.push(match);
      return `QUOTE${quotes.length - 1}`;
    });

    // Replace operators
    cleaned = cleaned.replace(/\s+AND\s+/g, " + ").replace(/\s+OR\s+/g, " | ");

    // Restore quotes
    quotes.forEach((quote, i) => {
      cleaned = cleaned.replace(`QUOTE${i}`, quote);
    });

    return cleaned;
  };

  translatedQuery = preserveQuotes(translatedQuery);

  // Clean up extra parentheses and spaces
  translatedQuery = translatedQuery
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();

  // Remove empty parentheses and fix double parentheses
  translatedQuery = translatedQuery
    .replace(/\(\s*\)/g, "")
    .replace(/\(\(+/g, "(")
    .replace(/\)\)+/g, ")");
  translatedQuery = translatedQuery.replace(/[“”]/g, '"').replace(/['']/g, "'");

  return translatedQuery;
};
const QuerySuggestion: React.FC<QuerySuggestionProps> = ({
  pubmedQuery,
  onAccept,
}) => {
  if (!pubmedQuery) return null;

  // Translate PubMed query to Semantic Scholar format
  //   const translateQuery = (query: string) => {
  //     // Remove field specifications
  //     let translatedQuery = query.replace("[Title/Abstract]", "");

  //     // Remove date restrictions if present
  //     if (translatedQuery.includes("[pdat]")) {
  //       translatedQuery = translatedQuery.split("[pdat]")[0];
  //     }

  //     // Replace operators
  //     translatedQuery = translatedQuery
  //       .replace(" AND ", " + ")
  //       .replace(" OR ", " | ")
  //       .trim();

  //     return translatedQuery;
  //   };

  const suggestedQuery = translateQuery(pubmedQuery);

  if (!suggestedQuery) return null;

  return (
    <Alert className="border-yellow-vivid-500 bg-yellow-vivid-50 dark:bg-yellow-vivid-800">
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          Suggested Semantic Scholar query:{" "}
          <span className="font-medium">{suggestedQuery}</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAccept(suggestedQuery)}
            className="flex items-center gap-1  "
          >
            <Check className="w-4 h-4" /> Use
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default QuerySuggestion;
