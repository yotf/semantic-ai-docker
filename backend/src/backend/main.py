from collections import OrderedDict
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import requests
import pandas as pd
from datetime import datetime, timedelta
import string
from fuzzywuzzy import fuzz
import io
import uuid
from Bio import Entrez
from xml.etree import ElementTree as ET


class SearchCache:
    def __init__(self, max_size=100, expiry_hours=24):
        self.cache = OrderedDict()
        self.max_size = max_size
        self.expiry = timedelta(hours=expiry_hours)

    def add(self, df: pd.DataFrame) -> str:
        # Clean expired entries before adding new one
        self._cleanup_expired()

        # Generate ID for this search
        search_id = str(uuid.uuid4())

        # Remove oldest if at capacity
        if len(self.cache) >= self.max_size:
            self.cache.popitem(last=False)

        self.cache[search_id] = {"df": df, "timestamp": datetime.now()}
        return search_id

    def get(self, search_id: str) -> Optional[pd.DataFrame]:
        if search_id not in self.cache:
            return None

        entry = self.cache[search_id]
        if datetime.now() - entry["timestamp"] > self.expiry:
            del self.cache[search_id]
            return None

        return entry["df"]

    def _cleanup_expired(self):
        now = datetime.now()
        expired = [
            k for k, v in self.cache.items() if now - v["timestamp"] > self.expiry
        ]
        for k in expired:
            del self.cache[k]


# Initialize cache at module level
search_cache = SearchCache()

app = FastAPI(title="Scholar Search API")
Entrez.email = "tara.petric@gmail.com"

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Vite's default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchResponse(BaseModel):
    semantic_scholar_results: int
    pubmed_results: int
    unique_to_pubmed: int
    unique_to_semantic: int
    duplicate_count: int
    papers: List[Dict]
    search_id: str


def normalize_title(title: str) -> str:
    """Normalize title for comparison"""
    title = str(title)
    title = title.lower().translate(str.maketrans("", "", string.punctuation))
    title = title.replace("‐", "")
    return title


def compare_paper_titles(title1: str, title2: str) -> bool:
    """Compare two titles using fuzzy matching"""
    normalized_title1 = normalize_title(title1)
    normalized_title2 = normalize_title(title2)
    match_score = fuzz.ratio(normalized_title1, normalized_title2)
    return match_score >= 98


def create_article_dict(
    pmid: str, title: str, abstract: str, pmc_id: str, authors: str, year: str
) -> Dict[str, str]:
    """Create a standardized article dictionary"""
    if isinstance(abstract, list):
        abstract = " ".join([str(a) for a in abstract])

    article_dict = {
        "pmid": pmid,
        "url": f"http://www.ncbi.nlm.nih.gov/pubmed/{pmid}",
        "title": title,
        "abstract": abstract,
        "authors": authors,
        "year": year,
    }

    if pmc_id:
        article_dict["pmc_id"] = f"http://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}"

    return article_dict


def get_pubmed_article_details(article_ids: List[str]) -> pd.DataFrame:
    """Fetch detailed information for PubMed articles"""
    try:
        handle = Entrez.efetch(
            db="pubmed", id=",".join(article_ids), rettype="medline", retmode="xml"
        )
        records = Entrez.read(handle)
        handle.close()

        articles = []
        for record in records["PubmedArticle"]:
            try:
                # Get article data with safe fallbacks
                article_data = record.get("MedlineCitation", {}).get("Article", {})

                # Extract title
                title = str(article_data.get("ArticleTitle", "No title available"))

                # Extract abstract
                abstract_data = article_data.get("Abstract", {})
                if isinstance(abstract_data, dict):
                    abstract = str(
                        abstract_data.get("AbstractText", ["No abstract available"])
                    )
                else:
                    abstract = str(abstract_data)

                # Extract PMID
                pmid = str(record["MedlineCitation"].get("PMID", "No PMID"))

                # Extract authors
                authors_list = article_data.get("AuthorList", [])
                author_names = []
                for author in authors_list:
                    forename = author.get("ForeName", "")
                    lastname = author.get("LastName", "")
                    if forename or lastname:
                        author_names.append(f"{forename} {lastname}".strip())
                authors = (
                    ", ".join(author_names) if author_names else "No authors listed"
                )

                # Extract year
                pub_date = (
                    article_data.get("Journal", {})
                    .get("JournalIssue", {})
                    .get("PubDate", {})
                )
                year = str(
                    pub_date.get(
                        "Year",
                        (
                            pub_date.get("MedlineDate", "").split()[0]
                            if pub_date.get("MedlineDate")
                            else "No year"
                        ),
                    )
                )

                # Extract PMC ID
                pmc_id = None
                if "PubmedData" in record and "ArticleIdList" in record["PubmedData"]:
                    for article_id in record["PubmedData"]["ArticleIdList"]:
                        if (
                            hasattr(article_id, "attributes")
                            and article_id.attributes.get("IdType") == "pmc"
                        ):
                            pmc_id = str(article_id)
                            break

                articles.append(
                    create_article_dict(pmid, title, abstract, pmc_id, authors, year)
                )
            except Exception as e:
                print(f"Error processing record: {e}")
                continue

        return (
            pd.DataFrame(articles).astype(str)
            if articles
            else pd.DataFrame(columns=["pmid", "title", "abstract", "authors", "year"])
        )
    except Exception as e:
        print(f"Error fetching articles: {e}")
        return pd.DataFrame()


def get_pmc_full_text_articles(df: pd.DataFrame) -> pd.DataFrame:
    """Fetch full text for PMC articles if available"""
    if "pmc_id" not in df.columns:
        return df

    df_with_pmcid = df[df["pmc_id"].notnull()]
    if df_with_pmcid.empty:
        return df

    pmcids = df_with_pmcid["pmc_id"].apply(lambda x: x.split("/")[-1]).tolist()
    articles = []

    try:
        handle = Entrez.efetch(
            db="pmc", id=",".join(pmcids), rettype="full", retmode="xml"
        )
        xml_data = handle.read()
        handle.close()

        root = ET.fromstring(xml_data)

        for article in root.findall(".//article"):
            try:
                pmcid = article.find(".//article-id[@pub-id-type='pmc']").text
                full_text = "\n".join(
                    [
                        p.text
                        for p in article.findall(".//body//p")
                        if p is not None and p.text is not None
                    ]
                )

                articles.append({"pmc_url": pmcid, "full_text": full_text})
            except Exception as e:
                print(f"Error processing PMC article: {e}")
                continue

    except Exception as e:
        print(f"Error processing PMC articles: {e}")

    if articles:
        result_df = pd.DataFrame(articles).astype(str)
        result_df["pmc_id"] = result_df["pmc_url"].apply(
            lambda x: f"http://www.ncbi.nlm.nih.gov/pmc/articles/PMC{x}"
        )
        return pd.merge(df, result_df, on="pmc_id", how="left")
    return df


def translate_pubmed_to_semantic(pubmed_query: str) -> str:
    """
    Translate PubMed query syntax to Semantic Scholar syntax
    Examples:
    - (cancer[Title/Abstract] AND therapy) -> (cancer + therapy)
    - (radiotherapy OR "radiation therapy") -> (radiotherapy | "radiation therapy")
    """
    # Remove field specifications like [Title/Abstract]
    query = pubmed_query.replace("[Title/Abstract]", "")

    # Remove date restrictions if present
    if "[pdat]" in query:
        query = query.split("[pdat]")[0]

    # Replace AND/OR operators
    query = query.replace(" AND ", " + ")
    query = query.replace(" OR ", " | ")

    # Preserve quotes around phrases
    # Remove any extra whitespace
    query = query.strip()

    # Group terms appropriately
    if "(" in query:
        # If query already has groups, keep them but translate operators
        return query
    else:
        # If no groups, wrap the whole query
        return f"({query})"


async def fetch_semantic_scholar_papers(query: str, date_range: str) -> List[Dict]:
    """Fetch papers from Semantic Scholar API"""
    url = "https://api.semanticscholar.org/graph/v1/paper/search/bulk"
    params = {
        "query": query,
        "publicationDateOrYear": date_range,
        "fields": "title,paperId,abstract,url,year,authors.name,citationCount,openAccessPdf,externalIds",
    }

    try:
        print(f"Fetching from Semantic Scholar with params: {params}")  # Debug log
        response = requests.get(url, params=params)
        response.raise_for_status()  # This will raise an exception for non-200 responses
        data = response.json()
        print(f"Response status: {response.status_code}")  # Debug log
        # print(f"Response data: {data}")  # Debug log
        papers = []
        for paper in data.get("data", []):
            try:
                paper_data = {
                    "title": paper.get("title", "No title available"),
                    "scholar_id": paper.get("paperId", "N/A"),
                    "abstract": paper.get("abstract", "No abstract available"),
                    "pdf_url": (
                        paper.get("openAccessPdf", {}).get("url", "N/A")
                        if paper.get("openAccessPdf")
                        else "N/A"
                    ),
                    "authors": ",".join(
                        [
                            author.get("name", "N/A")
                            for author in paper.get("authors", [])
                        ]
                    ),
                    "year": paper.get("year", "N/A"),
                    "pmid": paper.get("externalIds", {}).get("PubMed", "N/A"),
                    "citation_count_semantic": paper.get("citationCount", 0),
                }
                papers.append(paper_data)
            except Exception as e:
                print(f"Error processing paper: {e}")  # Debug log
                continue
        print(f"Returning {len(papers)} papers from Semantic Scholar")  # Debug log
        return pd.DataFrame(papers).astype(str)
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=503, detail=f"Semantic Scholar API error: {str(e)}"
        )
    except Exception as e:
        print(f"Unexpected error: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def deduplicate_papers(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicate papers based on title similarity using vectorized operations"""
    if df.empty:
        return df

    # Normalize all titles at once
    df = df.copy()  # Create a copy to avoid warnings
    df["normalized_title"] = df["title"].apply(normalize_title)

    # Create a mask for papers to keep
    keep_mask = pd.Series(True, index=df.index)

    # Use numpy arrays for faster comparison
    normalized_titles = df["normalized_title"].values

    for i in range(len(df)):
        if keep_mask.iloc[i]:
            # Get slice of remaining titles
            remaining_titles = normalized_titles[i + 1 :]
            remaining_indices = df.index[i + 1 :]

            # Calculate similarities
            similarities = pd.Series(
                [fuzz.ratio(normalized_titles[i], title) for title in remaining_titles],
                index=remaining_indices,
            )

            # Update keep_mask directly
            keep_mask.loc[remaining_indices[similarities >= 98]] = False

    # Drop the temporary normalized title column and return filtered DataFrame
    result = df[keep_mask].drop("normalized_title", axis=1)
    return result


def search_pubmed(query: str, articles_per_page: int = 1000) -> Dict:
    """Search PubMed API and return results"""
    handle_esearch = Entrez.esearch(
        db="pubmed", term=query, retmax=articles_per_page, sort="relevance"
    )
    data_esearch = Entrez.read(handle_esearch)
    id_list = data_esearch["IdList"]

    articles_df = pd.DataFrame().astype(str)
    warning = ""
    try:
        if len(id_list) > 0:
            articles_df = get_pubmed_article_details(id_list)
            articles_df = get_pmc_full_text_articles(articles_df)
        if "WarningList" in data_esearch:
            warning = data_esearch["WarningList"]
    except Exception as e:
        print(f"Error in search_pubmed: {e}")
        articles_df = pd.DataFrame(
            columns=["pmid", "title", "abstract", "authors", "year"]
        )

    return {"articles": articles_df, "warning": warning, "count": data_esearch["Count"]}


# Update the SearchRequest model
class SearchRequest(BaseModel):
    pubmed_query: str
    semantic_query: str
    date_start: str
    date_end: str


@app.post("/api/search", response_model=SearchResponse)
async def search_papers(request: SearchRequest):
    """Search endpoint handling paper search and deduplication"""
    try:

        # Validate dates
        date_start = datetime.strptime(request.date_start, "%Y-%m-%d")
        date_end = datetime.strptime(request.date_end, "%Y-%m-%d")

        if date_start > date_end:
            raise HTTPException(
                status_code=400, detail="Start date must be before end date"
            )

        # Format date range
        date_range = f"{request.date_start}:{request.date_end}"
        print(f"Date range: {date_range}")
        year_range = f"{date_start.year}-{date_end.year}"

        print(f"Processing search request: {request}")  # Debug log

        # Search both APIs
        pubmed_results = search_pubmed(request.pubmed_query)
        pubmed_df = pubmed_results["articles"]
        pubmed_count = int(pubmed_results["count"])
        print(f"\nPubMed raw results:")
        print(f"Total count from API: {pubmed_count}")
        print(f"Retrieved articles: {len(pubmed_df)}")
        semantic_df = await fetch_semantic_scholar_papers(
            request.semantic_query, date_range
        )
        semantic_count = len(semantic_df)
        print(f"\nSemantic Scholar raw results:")
        print(f"Retrieved articles: {semantic_count}")
        # Combine results

        filtered_semantic_df = semantic_df[semantic_df["pmid"] != "N/A"]
        non_pubmed_df = semantic_df[semantic_df["pmid"] == "N/A"]
        print(f"\nSemantic Scholar filtering:")
        print(f"Articles with PMIDs: {len(filtered_semantic_df)}")
        print(f"Articles without PMIDs: {len(non_pubmed_df)}")
        if not pubmed_df.empty and not filtered_semantic_df.empty:
            # Merge when both sources have data
            merged_df = pd.merge(
                pubmed_df,
                filtered_semantic_df,
                on="pmid",
                how="outer",
                suffixes=("_pubmed", "_semantic"),
            )
            print(f"\nMerged DataFrame info:")
            print(f"Size after merge: {len(merged_df)}")

            # Select best values from merged results
            merged_df["title"] = merged_df.apply(
                lambda row: (
                    row.get("title_pubmed")
                    if pd.notna(row.get("title_pubmed"))
                    else row.get("title_semantic")
                ),
                axis=1,
            )
            merged_df["abstract"] = merged_df.apply(
                lambda row: (
                    row.get("abstract_pubmed")
                    if pd.notna(row.get("abstract_pubmed"))
                    else row.get("abstract_semantic")
                ),
                axis=1,
            )
            merged_df["year"] = merged_df.apply(
                lambda row: (
                    row.get("year_pubmed")
                    if pd.notna(row.get("year_pubmed"))
                    else row.get("year_semantic")
                ),
                axis=1,
            )
            merged_df["authors"] = merged_df.apply(
                lambda row: (
                    row.get("authors_pubmed")
                    if pd.notna(row.get("authors_pubmed"))
                    else row.get("authors_semantic")
                ),
                axis=1,
            )
            merged_df["citation_count"] = merged_df.apply(
                lambda row: (
                    row.get("citation_count_semantic", 0)
                    if pd.notna(row.get("citation_count_semantic"))
                    else 0
                ),
                axis=1,
            )

            # Drop duplicate columns
            columns_to_drop = [
                "title_pubmed",
                "title_semantic",
                "abstract_pubmed",
                "abstract_semantic",
                "year_pubmed",
                "year_semantic",
                "authors_pubmed",
                "authors_semantic",
            ]
            merged_df = merged_df.drop(
                columns=[col for col in columns_to_drop if col in merged_df.columns]
            )
        else:
            # If one source is empty, use the non-empty one
            merged_df = pubmed_df if not pubmed_df.empty else filtered_semantic_df

        # Combine with non-PubMed results
        full_df = pd.concat([merged_df, non_pubmed_df], ignore_index=True)
        print(f"\nFull DataFrame before deduplication: {len(full_df)}")

        # Count overlapping PMIDs
        pubmed_pmids = set(pubmed_df["pmid"].tolist())
        semantic_pmids = set(filtered_semantic_df["pmid"].tolist())
        overlapping_pmids = pubmed_pmids.intersection(semantic_pmids)

        print(f"\nPMID Analysis:")
        print(f"Total PubMed PMIDs: {len(pubmed_pmids)}")
        print(f"Total Semantic Scholar PMIDs: {len(semantic_pmids)}")
        print(f"Overlapping PMIDs: {len(overlapping_pmids)}")

        # Calculate unique articles
        unique_to_pubmed = len(pubmed_pmids - semantic_pmids)
        unique_to_semantic = len(non_pubmed_df) + len(semantic_pmids - pubmed_pmids)

        deduplicate_by_titles_df = deduplicate_papers(full_df)
        print(f"\nDeduplication results:")
        print(f"Articles before deduplication: {len(full_df)}")
        print(f"Articles after deduplication: {len(deduplicate_by_titles_df)}")

        # Calculate duplicates
        duplicate_count = len(
            overlapping_pmids
        ) + (  # Duplicates from overlapping PMIDs
            len(full_df) - len(deduplicate_by_titles_df)
        )  # Duplicates from similar titles

        print(f"\nFinal Statistics:")
        print(f"Unique to PubMed: {unique_to_pubmed}")
        print(f"Unique to Semantic Scholar: {unique_to_semantic}")
        print(f"Duplicate Entries: {duplicate_count}")

        papers_list = []
        for _, row in deduplicate_by_titles_df.iterrows():
            paper = {
                "title": row["title"],
                "year": (
                    int(row["year"])
                    if pd.notna(row["year"]) and row["year"].isdigit()
                    else None
                ),  # Convert to integer
                "authors": [
                    author.strip()
                    for author in row["authors"].split(",")
                    if author.strip()
                ],  # Convert to string array
                "abstract": row["abstract"] if pd.notna(row["abstract"]) else None,
                "url": row["url"] if pd.notna(row["url"]) else None,
                "citation_count": (
                    int(row["citation_count"]) if pd.notna(row["citation_count"]) else 0
                ),  # Convert to integer
                "pdf_url": (
                    row["pdf_url"]
                    if pd.notna(row["pdf_url"]) and row["pdf_url"] != "N/A"
                    else None
                ),
            }
            papers_list.append(paper)

        search_id = search_cache.add(deduplicate_by_titles_df)
        print(f"Deduplicated:{deduplicate_by_titles_df.columns}")
        response = SearchResponse(
            semantic_scholar_results=semantic_count,
            unique_to_pubmed=unique_to_pubmed,
            unique_to_semantic=unique_to_semantic,
            duplicate_count=duplicate_count,
            pubmed_results=pubmed_count,
            papers=papers_list,
            search_id=search_id,
        )
        return response

    except ValueError as e:
        print(f"Validation error: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=400, detail=f"Invalid date format. Use YYYY-MM-DD: {str(e)}"
        )
    except Exception as e:
        print(f"Error in search_papers: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export/{search_id}")
async def export_results(search_id: str):
    """Export results to Excel"""
    try:
        df = search_cache.get(search_id)
        if df is None:
            raise HTTPException(
                status_code=404, detail="Search results not found or expired"
            )
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)

        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=search_results.xlsx"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
