import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Selam Cake Shop" },
      {
        name: "description",
        content:
          "Selam Cake Shop — Handcrafted cakes, cupcakes & pastries baked fresh daily.",
      },
      { property: "og:title", content: "Selam Cake Shop" },
      {
        property: "og:description",
        content:
          "Selam Cake Shop — Handcrafted cakes, cupcakes & pastries baked fresh daily.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/shop.html"
      title="Selam Cake Shop"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
