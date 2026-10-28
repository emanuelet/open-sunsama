import * as React from "react";
import { Check, Link2, Search, Send } from "lucide-react";
import type { Idea, KarakeepBookmark } from "@open-sunsama/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Label,
  Button,
  Input,
} from "@/components/ui";
import { RichTextEditor } from "@/components/ui/rich-text-editor.lazy";
import { cn } from "@/lib/utils";
import {
  useLinkIdeaToKarakeep,
  useSearchKarakeep,
  useSendIdeaToKarakeep,
  useUpdateIdea,
} from "@/hooks/useIdeas";
import { IdeaSubtaskList } from "./idea-subtask-list";
import { useIntegrationAccounts } from "@/hooks/useIntegrations";
import { KarakeepIcon } from "@/components/ui/karakeep-icon";

interface IdeaEditDialogProps {
  boardId: string;
  idea: Idea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Idea editor — a richer, mostly-live editor that mirrors the task modal:
 * completion checkbox + title (saved on blur), live subtasks, and rich
 * notes (saved on close).
 */
export function IdeaEditDialog({
  boardId,
  idea,
  open,
  onOpenChange,
}: IdeaEditDialogProps) {
  const [title, setTitle] = React.useState(idea.title);
  const [notes, setNotes] = React.useState(idea.notes ?? "");
  const [url, setUrl] = React.useState(idea.url ?? "");
  const [tags, setTags] = React.useState(idea.tags.join(", "));
  const [source, setSource] = React.useState(idea.source ?? "");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [results, setResults] = React.useState<KarakeepBookmark[]>([]);
  const updateIdea = useUpdateIdea(boardId);
  const { data: accounts = [] } = useIntegrationAccounts();
  const karakeepConnected = accounts.some((account) => account.provider === "karakeep" && account.isActive);
  const send = useSendIdeaToKarakeep(boardId);
  const search = useSearchKarakeep();
  const link = useLinkIdeaToKarakeep(boardId);

  React.useEffect(() => {
    if (open) {
      setTitle(idea.title);
      setNotes(idea.notes ?? "");
      setUrl(idea.url ?? "");
      setTags(idea.tags.join(", "));
      setSource(idea.source ?? "");
      setSearchQuery("");
      setResults([]);
    }
  }, [open, idea.id]);

  const isCompleted = !!idea.completedAt;

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(idea.title);
      return;
    }
    if (trimmed !== idea.title) {
      updateIdea.mutate({ id: idea.id, input: { title: trimmed } });
    }
  };

  const saveIdeaProperties = async () => {
    const nextTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (
      url.trim() === (idea.url ?? "") &&
      source.trim() === (idea.source ?? "") &&
      nextTags.join("\u0000") === idea.tags.join("\u0000")
    )
      return;
    await updateIdea.mutateAsync({
      id: idea.id,
      input: {
        url: url.trim() || null,
        source: source.trim() || null,
        tags: nextTags,
      },
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Persist notes on close.
      const cleaned = notes.replace(/<[^>]*>/g, "").trim().length ? notes : "";
      if (cleaned !== (idea.notes ?? "")) {
        updateIdea.mutate({
          id: idea.id,
          input: { notes: cleaned || null },
        });
      }
      void saveIdeaProperties();
    }
    onOpenChange(next);
  };

  const toggleComplete = () => {
    updateIdea.mutate({
      id: idea.id,
      input: { completedAt: isCompleted ? null : new Date() },
    });
  };

  const searchKarakeep = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    const found = await search.mutateAsync({ id: idea.id, query });
    setResults(found);
  };

  const sendToKarakeep = async () => {
    const cleanedNotes = notes.replace(/<[^>]*>/g, "").trim().length ? notes : null;
    await updateIdea.mutateAsync({
      id: idea.id,
      input: {
        title: title.trim() || idea.title,
        notes: cleanedNotes,
        url: url.trim() || null,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        source: source.trim() || null,
      },
    });
    await send.mutateAsync(idea.id);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Edit idea</DialogTitle>

        {/* Header: checkbox + title */}
        <div className="flex items-start gap-3 px-5 pb-3 pt-5">
          <button
            type="button"
            onClick={toggleComplete}
            aria-checked={isCompleted}
            role="checkbox"
            className={cn(
              "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all",
              isCompleted
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 hover:border-primary"
            )}
          >
            {isCompleted && <Check className="h-3 w-3" strokeWidth={3} />}
          </button>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            rows={1}
            placeholder="Idea title"
            className={cn(
              "mt-0.5 min-w-0 flex-1 resize-none border-none bg-transparent p-0 pr-6 text-lg font-semibold outline-hidden focus:ring-0",
              isCompleted && "text-muted-foreground line-through"
            )}
          />
        </div>

        {/* Body: description and properties */}
        <div className="max-h-[60vh] space-y-4 overflow-y-auto border-t border-border/40 px-5 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </Label>
            <RichTextEditor value={notes} onChange={setNotes} placeholder="Add details..." minHeight="120px" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subtasks
            </Label>
            <IdeaSubtaskList ideaId={idea.id} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Link
            </Label>
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              type="url"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tags
              </Label>
              <Input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="research, design"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Source
              </Label>
              <Input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Where it came from"
              />
            </div>
          </div>

          {karakeepConnected && <KarakeepPanel
            idea={idea}
            searchQuery={searchQuery}
            results={results}
            sending={send.isPending}
            searching={search.isPending}
            linking={link.isPending}
            canSend={Boolean(url.trim())}
            onSearchChange={setSearchQuery}
            onSend={sendToKarakeep}
            onSearch={searchKarakeep}
            onLink={(bookmarkId) => link.mutate({ id: idea.id, bookmarkId })}
          />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KarakeepPanel({
  idea,
  searchQuery,
  results,
  sending,
  searching,
  linking,
  canSend,
  onSearchChange,
  onSend,
  onSearch,
  onLink,
}: {
  idea: Idea;
  searchQuery: string;
  results: KarakeepBookmark[];
  sending: boolean;
  searching: boolean;
  linking: boolean;
  canSend: boolean;
  onSearchChange: (value: string) => void;
  onSend: () => void;
  onSearch: () => void;
  onLink: (bookmarkId: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <KarakeepIcon className="h-4 w-4" /> Karakeep
        </Label>
        {idea.karakeepBookmarkId ? (
          <span className="text-xs text-muted-foreground">Linked</span>
        ) : null}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={onSend}
        disabled={!canSend || sending || !!idea.karakeepBookmarkId}
      >
        <Send className="h-3.5 w-3.5" /> {idea.karakeepBookmarkId ? "Saved to Karakeep" : "Save to Karakeep"}
      </Button>
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearch();
            }
          }}
          placeholder="Search bookmarks and notes"
        />
        <Button
          size="icon"
          variant="outline"
          onClick={onSearch}
          disabled={!searchQuery.trim() || searching}
          aria-label="Search Karakeep"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>
      {results.map((bookmark) => (
        <button
          key={bookmark.id}
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded px-1 py-1 text-left text-xs hover:bg-accent"
          onClick={() => onLink(bookmark.id)}
          disabled={linking}
        >
          <span className="min-w-0 truncate">
            {bookmark.title ||
              bookmark.url ||
              bookmark.note ||
              "Untitled bookmark"}
          </span>
          <Link2 className="h-3.5 w-3.5 shrink-0" />
        </button>
      ))}
    </div>
  );
}
