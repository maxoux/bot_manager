import {
  ActivityFlags,
  ChannelType,
  ClientEvents,
  Events,
  Guild,
  GuildChannel,
  GuildChannelCreateOptions,
  GuildMember,
} from "discord.js";
import { difference, differenceWith, flatten, values } from "lodash";
import { DiscordBot, TBotEventListener, TBotGenerator } from "./types";

export default class GameVoiceChannelBot implements DiscordBot {
  public readonly masterChannelName = "Jeux";
  public static readonly BOT_TYPE_ID = "GAME_VOICE_CREATOR";
  private masterChannel!: GuildChannel;
  private managedChannels: GuildChannel[] = [];
  private members: Record<string, GuildMember> = {};

  static Module(): [string, TBotGenerator<GameVoiceChannelBot>] {
    return [this.BOT_TYPE_ID, this];
  }

  constructor(private readonly server: Guild, public readonly guildId: string) {
    this.init();
  }

  private async init() {
    try {
      const channels = await this.server.channels.fetch();

      const existingChannel = channels.find(
        (channel) => channel?.name === this.masterChannelName
      );

      this.masterChannel =
        existingChannel ||
        (await this.server.channels.create({
          type: ChannelType.GuildCategory,
          name: this.masterChannelName,
        }));

      // Delete handling channels
    } catch (e) {
      console.error(
        `Unable to init ${GameVoiceChannelBot.BOT_TYPE_ID} bot: `,
        e
      );
    }
  }

  async createChannel(
    options: GuildChannelCreateOptions & {
      type: ChannelType;
    }
  ) {
    console.log("creating channel %s", options.name);
    const channel = await this.server.channels.create({
      ...options,
      parent: this.masterChannel.id,
    });

    if (!channel)
      console.error(`Unable to create managed channel ${options.name} !`);

    this.managedChannels.push(channel);
  }

  async deleteChannel(id: GuildChannel["id"]) {
    const channelIndex = this.managedChannels.findIndex(
      (channel) => channel.id === id
    );
    const channel = this.managedChannels[channelIndex];

    if (channelIndex === -1) return;
    console.log("Deleting channel %s", channel.name);

    await this.managedChannels[channelIndex].delete();
    this.managedChannels = this.managedChannels.filter((c) => c.id !== id);
  }

  updateChannelListByName(channelNames: string[]) {
    console.log("Channel list to keep : ", channelNames);
    const channelToAdd = difference(
      channelNames,
      this.managedChannels.map((channel) => channel.name)
    );
    const channelToRemove = differenceWith(
      this.managedChannels,
      channelNames,
      (managerChannel, channelName) => managerChannel.name === channelName
    );

    const createPromise = channelToAdd.map((channel) =>
      this.createChannel({ name: channel, type: ChannelType.GuildVoice })
    );
    const deletePromise = channelToRemove.map((channel) =>
      this.deleteChannel(channel.id)
    );

    return Promise.all([...createPromise, ...deletePromise]);
  }

  async onPresenceUpdate([
    oldPresence,
    actualPresence,
  ]: ClientEvents["presenceUpdate"]) {
    console.log("Presence update for %s", this.guildId);
    if (!this.members[actualPresence.userId] && actualPresence.member)
      this.members[actualPresence.userId] = actualPresence.member;

    const members = values(this.members);
    console.log("Presence update, have %d members", members.length);

    const playedGames: string[] = flatten(
      members.map((member) => member.presence?.activities)
    )
      .filter((activity) => activity?.flags.has("Play"))
      .map((activity) => activity?.name)
      .filter((name) => !!name) as string[];

    console.log("Played games : ", playedGames);
    await this.updateChannelListByName([...new Set(playedGames)]);
  }

  async install() {
    // Create separated channel
  }

  async uninstall() {
    const channels = await this.server.channels.fetch();
    const masterChannelToUninstall = channels.find(
      (channel) => channel?.name === this.masterChannelName
    );

    if (!masterChannelToUninstall) return;

    masterChannelToUninstall.delete();
  }

  getEventListener() {
    const onPresenceChange: TBotEventListener = [
      Events.PresenceUpdate,
      this.onPresenceUpdate,
    ];

    return [onPresenceChange];
  }
}
