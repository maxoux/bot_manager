import { Guild, GuildMember } from "discord.js";

export default class MemberBotModule {
  protected members: Record<string, GuildMember> = {};

  constructor(
    protected readonly server: Guild,
    protected readonly guildId: string
  ) {}
}
