import { ClientEvents, Events, Guild } from "discord.js";

export type TBotGenerator<T> = new (server: Guild, guildId: string) => T;

export type TBotEventListener = [
  keyof ClientEvents,
  (...args: any[]) => Promise<void> | void
];

export interface DiscordBot {
  guildId: string;

  getEventListener: () => Array<TBotEventListener>;
  install: () => Promise<void>;
  uninstall: () => Promise<void>;
}
