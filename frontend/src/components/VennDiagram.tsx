const VennDiagram = ({
  pubmedUnique,
  semanticUnique,
  duplicates,
  className,
}: {
  pubmedUnique: number;
  semanticUnique: number;
  duplicates: number;
  className?: string;
}) => {
  return (
    <svg viewBox="0 0 300 200" className={className}>
      {/* PubMed circle */}
      <g className="group">
        <circle
          cx="120"
          cy="100"
          r="80"
          className="fill-cyan-500/20 stroke-cyan-500"
          strokeWidth="2"
        />
        <text x="70" y="100" className="text-sm fill-current">
          {pubmedUnique}
        </text>
        <text x="50" y="85" className="text-xs fill-muted-foreground">
          PubMed only
        </text>
      </g>

      {/* Semantic Scholar circle */}
      <g className="group">
        <circle
          cx="180"
          cy="100"
          r="80"
          className="fill-yellow-vivid-500/20 stroke-yellow-vivid-500"
          strokeWidth="2"
        />
        <text x="200" y="100" className="text-sm fill-current">
          {semanticUnique}
        </text>
        <text x="190" y="85" className="text-xs fill-muted-foreground">
          Semantic only
        </text>
      </g>

      {/* Overlap text */}
      <text
        x="135"
        y="100"
        className="text-sm font-medium fill-current text-center"
      >
        {duplicates}
      </text>
      <text x="122" y="115" className="text-xs fill-muted-foreground">
        duplicates
      </text>
    </svg>
  );
};

export default VennDiagram;
