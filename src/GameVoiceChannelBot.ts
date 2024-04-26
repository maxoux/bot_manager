import {
  BaseGuildTextChannel,
  ChannelType,
  ClientEvents,
  Events,
  Guild,
  GuildChannel,
  GuildMember,
} from "discord.js";
import { difference, differenceWith, flatten, values, without } from "lodash";
import { DiscordBot, TBotEventListener, TBotGenerator } from "./types";
import ChannelBotModule from "./modules/ChannelBotModule";

export default class GameVoiceChannelBot
  extends ChannelBotModule
  implements DiscordBot
{
  public readonly masterChannelName = "Jeux";
  public readonly textChannelName = "Activité";
  public static readonly BOT_TYPE_ID = "GAME_VOICE_CREATOR";
  private masterChannel!: GuildChannel;
  private textChannel!: GuildChannel;
  private gamesAnnounced: string[] = [];
  private members: Record<string, GuildMember> = {};

  static Module(): [string, TBotGenerator<GameVoiceChannelBot>] {
    return [this.BOT_TYPE_ID, this];
  }

  constructor(
    protected readonly server: Guild,
    protected readonly guildId: string
  ) {
    super(server, guildId);
    this.init();
  }

  private async init() {
    try {
      const _channels = [...(await this.server.channels.fetch())];
      const channels = _channels.map((a) => a[1]);

      const existingMasterChannel = channels.find(
        (channel) => channel?.name === this.masterChannelName
      );

      const existingTextChannel = channels.find(
        (channel) => channel?.name === this.textChannelName
      );

      this.masterChannel =
        existingMasterChannel ||
        (await this.server.channels.create({
          type: ChannelType.GuildCategory,
          name: this.masterChannelName,
        }));

      this.textChannel =
        existingTextChannel ||
        (await this.createChannel({
          type: ChannelType.GuildText,
          name: this.textChannelName,
          parent: this.masterChannel.id,
        }));

      const promises = channels.map(async (channel) => {
        if (channel?.parent !== this.masterChannel) return;

        const channelNameAlreadyExist = this.managedChannels.find(
          (managedChannel) => managedChannel.name === channel.name
        );

        if (channelNameAlreadyExist) {
          console.log("Duplicate channel: %s", channel.name);
          await channel.delete("Duplicate channel");
        } else {
          console.log("Owning channel %s", channel.name);
          this.managedChannels.push(channel);
        }
      });

      await Promise.all(promises);

      // Delete handling channels
    } catch (e) {
      console.error(
        `Unable to init ${GameVoiceChannelBot.BOT_TYPE_ID} bot: `,
        e
      );
    }
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
      (managerChannel, channelName) =>
        managerChannel.name === channelName &&
        channelName !== this.textChannelName
    );

    const createPromise = channelToAdd.map((channel) =>
      this.createChannel({
        name: channel,
        type: ChannelType.GuildVoice,
        parent: this.masterChannel.id,
      })
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

    const _playedGames: string[] = flatten(
      members.map((member) => member.presence?.activities)
    )
      .map((activity) => activity?.name)
      .filter((name) => !!name) as string[];
    const playedGames: string[] = [...new Set(_playedGames)];

    console.log("Played games : ", playedGames);
    await this.updateChannelListByName(playedGames);
    await this.announce(playedGames);
  }

  async announce(gamesPlayed: string[]) {
    for (let game in gamesPlayed) {
      const players = Object.values(this.members).filter(
        (member) => member.presence?.activities[0]?.name === game
      );
      if (players.length > 0)
        console.log("%d players is on %s", players.length, game);
      if (this.gamesAnnounced.includes(game) && players.length >= 2) {
        (this.textChannel as BaseGuildTextChannel).send(`Ca game à ${game} !`);
        this.gamesAnnounced.push(game);
        setTimeout(() => {
          this.gamesAnnounced = without<string>(this.gamesAnnounced, game);
        }, 30 * 60 * 1000);
      }
    }
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
