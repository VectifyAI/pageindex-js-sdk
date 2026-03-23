"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputHeader,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { SettingsDialog, SettingsButton } from "@/components/settings-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SettingsProvider, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  CheckCircle2Icon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  FileIcon,
  Loader2Icon,
  PaperclipIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocumentItem {
  id: string;
  name: string;
  status: string;
}

interface TextPart {
  type: "text";
  content: string;
}

interface ToolPart {
  type: "tool";
  toolName: string;
  content: string;
  state: "running" | "completed";
}

type MessagePart = TextPart | ToolPart;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: MessagePart[];
  docs?: DocumentItem[];
}

/* ------------------------------------------------------------------ */
/*  Tool Card                                                          */
/* ------------------------------------------------------------------ */

function ToolCard({ part }: { part: ToolPart }) {
  return (
    <Collapsible className="not-prose mb-4 w-full rounded-md border" defaultOpen={false}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 p-3">
        <div className="flex items-center gap-2">
          <WrenchIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{part.toolName}</span>
          <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
            {part.state === "running" ? (
              <ClockIcon className="size-4 animate-pulse" />
            ) : (
              <CheckCircleIcon className="size-4 text-green-600" />
            )}
            {part.state === "running" ? "Running" : "Completed"}
          </Badge>
        </div>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      {part.content && (
        <CollapsibleContent>
          <div className="border-t p-3">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
              {part.content}
            </pre>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function DocumentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "ready":
    case "completed":
      return <CheckCircle2Icon className="size-4 text-green-500" />;
    case "processing":
      return <Loader2Icon className="size-4 animate-spin text-yellow-500" />;
    default:
      return <FileIcon className="size-4 text-muted-foreground" />;
  }
}

let messageId = 0;
function nextId() {
  return String(++messageId);
}

function getTextContent(parts: MessagePart[]): string {
  return parts
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.content)
    .join("");
}

/* ------------------------------------------------------------------ */
/*  Stream parser                                                      */
/* ------------------------------------------------------------------ */

interface StreamParserState {
  parts: MessagePart[];
}

function createStreamParser(): StreamParserState {
  return { parts: [] };
}

function processChunk(
  state: StreamParserState,
  chunk: {
    choices?: Array<{ delta?: { content?: string } }>;
    block_metadata?: { type: string; tool_name?: string };
  },
): StreamParserState {
  const parts = [...state.parts];
  const meta = chunk.block_metadata;
  const delta = chunk.choices?.[0]?.delta?.content;

  if (meta) {
    if (meta.type === "mcp_tool_use_start" && meta.tool_name) {
      parts.push({
        type: "tool",
        toolName: meta.tool_name,
        content: "",
        state: "running",
      });
    } else if (meta.type === "tool_use_stop") {
      const last = parts[parts.length - 1];
      if (last?.type === "tool") {
        parts[parts.length - 1] = { ...last, state: "completed" };
      }
    }
  }

  if (delta) {
    const last = parts[parts.length - 1];
    if (last?.type === "tool" && last.state === "running") {
      parts[parts.length - 1] = { ...last, content: last.content + delta };
    } else if (last?.type === "text") {
      parts[parts.length - 1] = { ...last, content: last.content + delta };
    } else {
      parts.push({ type: "text", content: delta });
    }
  }

  return { parts };
}

/* ------------------------------------------------------------------ */
/*  ChatContent                                                        */
/* ------------------------------------------------------------------ */

function ChatContent() {
  const { isConfigured, isLoaded, getHeaders } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [input, setInput] = useState("");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const res = await fetch("/api/documents", { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.docs || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingDocs(false);
    }
  }, [getHeaders]);

  useMountEffect(() => {
    if (isLoaded && !isConfigured) {
      setSettingsOpen(true);
    }
  });

  const handleDropdownOpenChange = useCallback(
    (open: boolean) => {
      setDropdownOpen(open);
      if (open && isConfigured) {
        fetchDocuments();
      }
    },
    [isConfigured, fetchDocuments],
  );

  const toggleDocSelection = useCallback((doc: DocumentItem) => {
    setSelectedDocs((prev) => {
      const isSelected = prev.some((d) => d.id === doc.id);
      if (isSelected) {
        return prev.filter((d) => d.id !== doc.id);
      }
      return [...prev, doc];
    });
  }, []);

  const removeSelectedDoc = useCallback((docId: string) => {
    setSelectedDocs((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const handleSubmit = async (message: { text?: string }) => {
    const text = message.text?.trim();
    if (!text || isStreaming || !isConfigured) return;

    setError(null);
    const attachedDocs =
      selectedDocs.length > 0 ? [...selectedDocs] : undefined;
    const selectedDocIds = selectedDocs.map((d) => d.id);
    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: text,
      docs: attachedDocs,
    };
    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: "assistant",
      content: "",
      parts: [],
    };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, assistantMsg]);
    setInput("");
    setSelectedDocs([]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getHeaders(),
        },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          docIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let parser = createStreamParser();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
          const data = trimmedLine.slice(6);
          if (data === "[DONE]") break;

          try {
            const chunk = JSON.parse(data);
            if (chunk.error) throw new Error(chunk.error);
            parser = processChunk(parser, chunk);
            const textContent = getTextContent(parser.parts);
            setMessages([
              ...newMessages,
              {
                ...assistantMsg,
                content: textContent,
                parts: parser.parts,
              },
            ]);
          } catch (parseError) {
            if (
              parseError instanceof Error &&
              parseError.message !== "Unexpected end of JSON input"
            ) {
              throw parseError;
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
      setMessages(newMessages);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <main className="relative flex-1 overflow-hidden">
        <Conversation className="absolute inset-0">
          <ConversationContent className="mx-auto max-w-4xl">
            {messages.length === 0 && (
              <ConversationEmptyState
                title="Hello there!"
                description="How can I help you today?"
              />
            )}

            {messages.map((msg) => (
              <Message key={msg.id} from={msg.role}>
                {msg.role === "user" && msg.docs && msg.docs.length > 0 && (
                  <div className="ml-auto flex flex-wrap gap-2">
                    {msg.docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 p-2 text-sm"
                      >
                        <FileIcon className="size-8 shrink-0 text-muted-foreground/50" />
                        <span className="max-w-48 truncate font-medium">
                          {doc.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <MessageContent>
                  {msg.role === "user" ? (
                    <span>{msg.content}</span>
                  ) : msg.parts && msg.parts.length > 0 ? (
                    msg.parts.map((part, i) =>
                      part.type === "tool" ? (
                        <ToolCard key={i} part={part} />
                      ) : part.content ? (
                        <MessageResponse key={i}>
                          {part.content}
                        </MessageResponse>
                      ) : null,
                    )
                  ) : msg.content ? (
                    <MessageResponse>{msg.content}</MessageResponse>
                  ) : null}
                </MessageContent>
              </Message>
            ))}

            {isStreaming &&
              messages.length > 0 &&
              (() => {
                const last = messages[messages.length - 1];
                const hasParts = last?.parts && last.parts.length > 0;
                const hasContent = !!last?.content;
                return !hasParts && !hasContent;
              })() && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer className="text-sm text-muted-foreground">
                      Thinking...
                    </Shimmer>
                  </MessageContent>
                </Message>
              )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </main>

      {/* Error */}
      {error && (
        <div className="mx-auto w-full max-w-4xl px-4">
          <div className="mb-2 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 mx-auto w-full max-w-4xl bg-background pb-4">
        <PromptInput onSubmit={handleSubmit}>
          {selectedDocs.length > 0 && (
            <PromptInputHeader className="flex-wrap gap-2 px-3 pt-2 pb-1">
              {selectedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-sm"
                >
                  <FileIcon className="size-3.5 text-muted-foreground" />
                  <span className="max-w-32 truncate">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => removeSelectedDoc(doc.id)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              ))}
            </PromptInputHeader>
          )}

          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isConfigured
                  ? "Ask anything..."
                  : "Configure settings to start..."
              }
              disabled={!isConfigured}
              className="min-h-16 resize-none text-sm sm:text-base"
            />
          </PromptInputBody>

          <PromptInputFooter className="px-1 sm:px-2">
            <PromptInputTools>
              <PromptInputActionMenu
                open={dropdownOpen}
                onOpenChange={handleDropdownOpenChange}
              >
                <PromptInputActionMenuTrigger
                  disabled={!isConfigured}
                  className="ml-0.5 shrink-0 gap-1 rounded-full border border-border p-1 hover:bg-muted sm:ml-1"
                >
                  <PaperclipIcon className="size-4" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent className="w-64">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Recent Documents</span>
                    {isLoadingDocs && (
                      <Loader2Icon className="size-3 animate-spin" />
                    )}
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  {documents.length === 0 && !isLoadingDocs && (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No documents yet
                    </div>
                  )}

                  {documents.map((doc) => {
                    const isSelected = selectedDocs.some(
                      (d) => d.id === doc.id,
                    );
                    return (
                      <PromptInputActionMenuItem
                        key={doc.id}
                        className="flex items-center justify-between"
                        onSelect={() => {
                          toggleDocSelection(doc);
                          setDropdownOpen(false);
                        }}
                      >
                        <span
                          className={cn(
                            "mr-2 flex-1 truncate",
                            isSelected && "font-medium",
                          )}
                        >
                          {doc.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {isSelected && (
                            <CheckCircle2Icon className="size-4 text-primary" />
                          )}
                          <DocumentStatusIcon status={doc.status} />
                        </div>
                      </PromptInputActionMenuItem>
                    );
                  })}
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>

            <div className="flex items-center gap-1">
              <SettingsButton onClick={() => setSettingsOpen(true)} />
              <PromptInputSubmit
                status={isStreaming ? "streaming" : "ready"}
                disabled={!input.trim() || isStreaming || !isConfigured}
                className="m-1.5 h-7 w-7 rounded-full sm:m-2 sm:h-8 sm:w-8"
              />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <SettingsProvider>
      <ChatContent />
    </SettingsProvider>
  );
}
