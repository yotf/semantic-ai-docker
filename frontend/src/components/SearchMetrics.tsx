import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon, Search, Database } from "lucide-react";
import VennDiagram from "./VennDiagram";
import { SearchResponse } from "./SearchInterface";

const SearchMetrics = ({ data }: { data: SearchResponse }) => {
  const totalUnique =
    data.unique_to_pubmed + data.unique_to_semantic + data.duplicate_count;

  const stats = [
    {
      label: "PubMed Results",
      value: data.pubmed_results,
      unique: data.unique_to_pubmed,
      icon: <Search className="h-4 w-4 text-cyan-500" />,
      color: "cyan",
    },
    {
      label: "Semantic Scholar",
      value: data.semantic_scholar_results,
      unique: data.unique_to_semantic,
      icon: <Database className="h-4 w-4 text-yellow-500" />,
      color: "yellow-vivid",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Metrics Card */}
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <PieChartIcon className="h-5 w-5 text-gray-500" />
            Search Results Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Key Metrics */}
            <div className="space-y-6">
              {/* Source Statistics */}
              <div className="space-y-4">
                {stats.map((stat, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {stat.icon}
                      <span>{stat.label}</span>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <span className="text-3xl font-bold">{stat.value}</span>
                      <span className="text-sm text-gray-500">
                        {stat.unique} unique
                      </span>
                    </div>
                    {/* Coverage Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Coverage</span>
                        <span className="font-medium">
                          {Math.round((stat.value / totalUnique) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className={`h-full rounded-full bg-${stat.color}-500`}
                          style={{
                            width: `${(stat.value / totalUnique) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Venn Diagram */}
            <div className="flex flex-col">
              {/* <div className="flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-500">Overlap Analysis</span>
              </div> */}
              <Card className="flex-1 p-4 bg-gray-50 dark:bg-gray-900">
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {data.duplicate_count}
                    </span>
                    <span className="text-sm text-gray-500">
                      duplicates removed
                    </span>
                  </div>
                  <VennDiagram
                    pubmedUnique={data.unique_to_pubmed}
                    semanticUnique={data.unique_to_semantic}
                    duplicates={data.duplicate_count}
                    className="w-full h-48 mt-4"
                  />
                </div>
              </Card>
            </div>
          </div>

          {/* Total Unique Summary */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">
                Total Unique Papers
              </span>
              <span className="text-2xl font-bold">{totalUnique}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SearchMetrics;
