export async function shareCard(input: { title: string; url: string; code: string }): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (navigator.share) await navigator.share({ title: input.title, url: input.url, text: "Hold me to it." }).catch(() => undefined);
    return;
  }
  ctx.fillStyle = "#F7F5F0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0A0A0B";
  ctx.font = "500 28px Inter, sans-serif";
  ctx.fillText("CINCH", 80, 120);
  ctx.font = "400 64px Fraunces, serif";
  wrap(ctx, input.title, 80, 280, 920, 74);
  ctx.font = "500 36px IBM Plex Mono, monospace";
  ctx.fillText(input.code.toUpperCase(), 80, 1180);
  ctx.font = "400 24px Inter, sans-serif";
  ctx.fillText("Hold them to it.", 80, 1240);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], "cinch.png", { type: "image/png" })] })) {
    await navigator.share({
      title: input.title,
      text: "Hold me to it.",
      url: input.url,
      files: [new File([blob], "cinch.png", { type: "image/png" })],
    }).catch(() => undefined);
    return;
  }
  if (navigator.share) await navigator.share({ title: input.title, url: input.url, text: "Hold me to it." }).catch(() => undefined);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = `${line}${w} `;
    if (ctx.measureText(test).width > max) {
      ctx.fillText(line, x, yy);
      line = `${w} `;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}
