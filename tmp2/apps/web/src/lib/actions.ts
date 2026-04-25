import { createServerFn } from "@tanstack/react-start"
import { crawlUrl } from "./crawlers"

export const crawlUrlAction = createServerFn({
  method: 'POST',
})
  .inputValidator((url: string) => url)
  .handler(async ({ data: url }) => {
    return await crawlUrl(url)
  })
