import { createRouter } from "./context";
//import { createProtectedRouter } from "./protected-router";
import { prisma } from "../../server/db/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { User } from "@prisma/client";

export const matchRouter = createRouter()
  .query("getPotentialMatch", {
    async resolve({ ctx }) {
      if (!ctx.session || !ctx.session.user?.id) {
        throw new TRPCError({
          message: "You are not signed in",
          code: "UNAUTHORIZED",
        });
      }

      const usersBlocked = await prisma.user.findFirst({
        where: { id: ctx.session.user.id },
        select: {
          blockedByMe: true,
          blockedMe: true,
        },
      });

      const alreadyMatchedInitiated = await prisma.match.findMany({
        where: {
          requestInitiatorId: ctx.session.user.id,
        },
        select: {
          requestTargetId: true,
        },
      });

      const alreadyMatchedTargeted = await prisma.match.findMany({
        where: {
          requestTargetId: ctx.session.user.id,
        },
        select: {
          requestInitiatorId: true,
        },
      });

      const alreadyMatchedWithIds = [
        //combine targeted and initiated
        ...alreadyMatchedInitiated.map((user) => user.requestTargetId),
        ...alreadyMatchedTargeted.map((user) => user.requestInitiatorId),
        ...usersBlocked!.blockedByMe.map((block) => block.blockedUserId),
        ...usersBlocked!.blockedMe.map((block) => block.blockByUserId),
        ctx.session.user.id,
      ];

      console.log(
        "already matched with number: ",
        alreadyMatchedWithIds.length
      );

      const filter = await prisma.filter.findFirst({
        where: { userId: ctx.session.user.id },
      });

      let userStillNotMatched: User | null = null;

      if (!filter) {
        userStillNotMatched = await prisma.user.findFirst({
          where: {
            id: {
              notIn: alreadyMatchedWithIds,
            },
            description: { not: "Add your description here" },
          },
        });
      } else {
        userStillNotMatched = await prisma.user.findFirst({
          where: {
            age: { gte: filter.ageLowerLimit, lte: filter.ageUpperLimit },
            id: {
              notIn: alreadyMatchedWithIds,
            },
            //description: { not: "Add your description here" },
            ...(filter.genders.length > 0
              ? { gender: { in: filter.genders } }
              : {}),
            ...(filter.roles.length > 0 ? { role: { in: filter.roles } } : {}),
            ...(filter.servers.length > 0
              ? { server: { in: filter.servers } }
              : {}),
            ...(filter.tiers.length > 0 ? { tier: { in: filter.tiers } } : {}),
          },
        });
      }

      const userRiotAccount = await prisma.leagueAccount.findFirst({
        //if it wasnt find first we could use prisma include from relation queries
        where: { userId: userStillNotMatched?.id },
      });

      console.log(
        ctx.session.user.name,
        " matched with ",
        userStillNotMatched?.name
      );

      return { user: userStillNotMatched, rankedStats: userRiotAccount };
    },
  })
  .query("isFriendsWith", {
    input: z.object({
      otherUserId: z.string(),
    }),
    async resolve({ ctx, input }) {
      if (!ctx.session || !ctx.session.user?.id) {
        return true; //we are only using this in Profile so this should work
      }

      const userId = ctx.session.user.id;

      return (
        (await prisma.match.findFirst({
          where: {
            OR: [
              {
                requestInitiatorId: userId,
                requestTargetId: input.otherUserId,
              },
              {
                requestInitiatorId: input.otherUserId,
                requestTargetId: userId,
              },
            ],
          },
        })) !== null
      );
    },
  })
  .mutation("createMatch", {
    input: z.object({
      requestInitiatorId: z.string(),
      requestTargetId: z.string(),
      addAsFriend: z.boolean(),
    }),
    async resolve({ ctx, input }) {
      if (
        !ctx.session ||
        !ctx.session.user?.id ||
        ctx.session.user.id != input.requestInitiatorId
      ) {
        throw new TRPCError({
          message: "You are not signed in",
          code: "UNAUTHORIZED",
        });
      }

      const matchExists = await prisma.match.findMany({
        where: {
          OR: [
            {
              requestInitiatorId: input.requestInitiatorId,
              requestTargetId: input.requestTargetId,
            },
            {
              requestInitiatorId: input.requestTargetId,
              requestTargetId: input.requestInitiatorId,
            },
          ],
        },
      });

      if (matchExists.length > 0) {
        return;
      } else {
        await prisma.match.create({
          data: {
            requestInitiatorId: input.requestInitiatorId,
            requestTargetId: input.requestTargetId,
            pending: input.addAsFriend,
          },
        });
      }
    },
  })
  .query("getFriendRequests", {
    async resolve({ ctx }) {
      if (!ctx.session || !ctx.session.user?.id) {
        throw new TRPCError({
          message: "You are not signed in",
          code: "UNAUTHORIZED",
        });
      }

      return await prisma.match.findMany({
        where: {
          requestTargetId: ctx.session?.user?.id,
          pending: true,
          accepted: false,
        },
        include: {
          requestInitiator: {
            select: {
              id: true,
              name: true,
              firstName: true,
              image: true,
              role: true,
              fav_champion1: true,
              tier: true,
            },
          },
        },
      });
    },
  })
  .query("numberFriendRequests", {
    async resolve({ ctx }) {
      if (!ctx.session || !ctx.session.user?.id) {
        throw new TRPCError({
          message: "You are not signed in",
          code: "UNAUTHORIZED",
        });
      }

      return await prisma.match.count({
        where: {
          requestTargetId: ctx.session?.user?.id,
          pending: true,
          accepted: false,
        },
      });
    },
  })
  .query("getFriends", {
    async resolve({ ctx }) {
      if (!ctx.session || !ctx.session.user?.id) {
        throw new TRPCError({
          message: "You are not signed in",
          code: "UNAUTHORIZED",
        });
      }

      const allFriends = await prisma.match.findMany({
        where: {
          OR: [
            {
              requestTargetId: ctx.session?.user?.id,
              pending: false,
              accepted: true,
            },
            {
              requestInitiatorId: ctx.session?.user?.id,
              pending: false,
              accepted: true,
            },
          ],
        },
        include: {
          requestInitiator: {
            select: {
              id: true,
              name: true,
              firstName: true,
              image: true,
            },
          },
          requestTarget: {
            select: {
              id: true,
              name: true,
              firstName: true,
              image: true,
            },
          },
        },
      });

      const allFriendsWithLastMessage = await Promise.all(
        allFriends.map(async (friend) => {
          const lastMessage = await prisma.message.findMany({
            select: {
              body: true,
              timestamp: true,
            },
            where: {
              OR: [
                {
                  messageReceiverId: friend.requestInitiatorId,
                  messageSenderId: friend.requestTargetId,
                },
                {
                  messageReceiverId: friend.requestTargetId,
                  messageSenderId: friend.requestInitiatorId,
                },
              ],
            },
            orderBy: {
              timestamp: "desc",
            },
            take: 1,
          });

          const numUnseenMsgs = await prisma.message.count({
            where: {
              messageReceiverId: { equals: ctx.session?.user?.id },
              messageSenderId: {
                equals:
                  ctx.session?.user?.id == friend.requestInitiatorId
                    ? friend.requestTargetId
                    : friend.requestInitiatorId,
              },
              messageSeen: false,
            },
          });

          return { ...friend, lastMessage, numUnseenMsgs };
        })
      );

      return allFriendsWithLastMessage.sort((friend1, friend2) => {
        if (!friend1.lastMessage || !friend1.lastMessage[0]) {
          return 1;
        }
        if (!friend2.lastMessage || !friend2.lastMessage[0]) {
          return -1;
        }

        if (
          friend1.lastMessage[0]?.timestamp < friend2.lastMessage[0]?.timestamp
        ) {
          return 1;
        } else return -1;
      });
    },
  })
  .mutation("acceptFriendReq", {
    input: z.object({
      requestInitiatorId: z.string(),
    }),
    async resolve({ ctx, input }) {
      if (!ctx.session || !ctx.session.user?.id) {
        throw new TRPCError({
          message: "You are not signed in",
          code: "UNAUTHORIZED",
        });
      }

      const requestTargetId = ctx.session.user.id;

      await prisma.match.updateMany({
        where: {
          requestInitiatorId: input.requestInitiatorId,
          requestTargetId: requestTargetId,
        },
        data: {
          pending: false,
          accepted: true,
        },
      });
    },
  })
  .mutation("declineFriendReq", {
    input: z.object({
      requestInitiatorId: z.string(),
    }),
    async resolve({ ctx, input }) {
      if (!ctx.session || !ctx.session.user?.id) {
        throw new TRPCError({
          message: "You are not signed in",
          code: "UNAUTHORIZED",
        });
      }

      const requestTargetId = ctx.session.user.id;

      await prisma.match.updateMany({
        where: {
          requestInitiatorId: input.requestInitiatorId,
          requestTargetId: requestTargetId,
        },
        data: {
          pending: false,
          accepted: false,
        },
      });
    },
  });
