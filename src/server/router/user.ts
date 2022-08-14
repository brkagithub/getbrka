import { createRouter } from "./context";
//import { createProtectedRouter } from "./protected-router";
import { prisma } from "../../server/db/client";

export const userRouter = createRouter()
  .query("getSession", {
    resolve({ ctx }) {
      return ctx.session;
    },
  })
  .query("me", {
    resolve({ ctx }) {
      return ctx.session?.user;
    },
  })
  .query("meFullInfo", {
    resolve({ ctx }) {
      return prisma.user.findFirst({
        where: { id: ctx.session?.user?.id },
      });
    },
  });
