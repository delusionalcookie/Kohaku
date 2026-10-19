import { createFileRoute } from "@tanstack/react-router";
import { KohakuGame } from "@/game/kohaku";

export const Route = createFileRoute("/")({
  component: KohakuGame,
});
