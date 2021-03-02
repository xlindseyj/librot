import dotenv from 'dotenv';
import axios, { AxiosResponse } from 'axios';
import cheerio from 'cheerio';
import { Channel, ChannelCreationOverwrites, Client, Message, TextChannel } from 'discord.js';
// import { CommandHandler } from './discord/commands';
import { discordConfig } from './discord/config';
import { log } from './services/utilities.service';
import { forEach } from 'lodash';
import { DateTypeEnum } from './enums/date-types.enum';

dotenv.config();

export default class Server {
  public PORT: number = Number(process.env.PORT) || 5001;
  public discordClient: Client = new Client();
  public startTime: string;
  // public commandHandler = new CommandHandler(discordConfig.prefix);
  public baseUrl: string = 'https://cafeastrology.com/libradailyhoroscope.html';
  public postsUpToDate = false;
  public dateTypesEntries: any[];
  public channelDateTypes = [
    DateTypeEnum.DAILY,
    DateTypeEnum.MONTHLY,
    DateTypeEnum.YEARLY
  ];

  public checkPreviousChatEntry = async (type: string, date: string): Promise<void> => {
    if (type === 'daily') {
      // get last post in chat and compare to date
    }
  }

  public createMessage = async (date: string, type: string): Promise<string> => {
    let post = '';

    if (type === DateTypeEnum.DAILY) {
      post = this.dateTypesEntries[0];
    } else if (type === DateTypeEnum.MONTHLY) {
      forEach(this.dateTypesEntries[1], (horoscope: string) => post += horoscope + ' ');
    } else {
      forEach(this.dateTypesEntries[2], (horoscope: string) => post += horoscope + ' ');
    }
    
    return `
      ${date ? date : 'Invalid date'}

      ${post}
    `;
  }
  
  public fetchData = async (url: string): Promise<void | AxiosResponse<any>> => {
    log("Crawling data from cafeastrology - horoscopes...", true)
    let response: any = await axios(url).catch((error) => log(error));

    if (response.status !== 200){
      log("Error occurred while fetching data", true);
      return;
    }

    return response;
  }

  public getHoroscopeChannel = (channels: any, type: string): TextChannel => {
    return channels.filter((channel: TextChannel) => channel.name === 'horoscope-'+type);
  }

  public getDateTypeHeader = (type: string): string => {
    if (type === DateTypeEnum.DAILY) {
      return 'body > div.site-container > div.site-inner > div > main > article > div.entry-content > p:nth-child(6)';
    } else if (type === DateTypeEnum.MONTHLY) {
      return '#featured-post-8 > div > article > header > h2 > a';
    } else {
      // fix
      return '2021 Yearly Horoscope';
    }
  }

  public getDateTypeEntries = async ($: cheerio.Root): Promise<void> => {
    const dailyEntry = $('body > div.site-container > div.site-inner > div > main > article > div.entry-content > p:nth-child(7)')
      .text()
      .split('/>')[1];
    const monthlyEntry: string[] = $('article')
      .find('div')
      .find('p')
      .toArray()
      .filter((el: cheerio.Element, i: number) => i >= 20 && i <=30)
      .map((el: cheerio.Element, i: number) => $(el).text());
    const yearlyEntry = $('article')
      .find('div')
      .find('p')
      .toArray()
      .filter((el: cheerio.Element, i: number) => i >= 35 && i <=43)
      .map((el: cheerio.Element) => $(el).text());

    this.dateTypesEntries = [
      dailyEntry,
      monthlyEntry,
      yearlyEntry
    ];
  }

  public initializeDiscord = async (): Promise<void> => {
    log('Attempting to connect to Discord server');

    this.discordClient.once('ready', async () => {
      log('Discord server is live', true);
      await this.refreshChannels();
      setInterval(this.refreshChannels, 1000 * 60 * 60);
    });

    this.discordClient.on('message', async (message: Message) => {});

    this.discordClient.on('error', (error) => {
      log(`Discord server encountered an error: ${error}`, true);
    });

    this.discordClient.login(discordConfig.token);
  }

  public refreshChannels = async (): Promise<void> => {
    await this.fetchData(this.baseUrl).then(async (res: any) => {
      const html = res.data;
      const $ = cheerio.load(html);
      await this.getDateTypeEntries($);

      const channels: Channel[] = [ ...this.discordClient.channels.cache.entries() ]
        .filter(([id, channel]: [string, any]) => channel.type === 'text')
        .map((channel: any) => channel[1]
      );

      forEach(this.channelDateTypes, async (dateType: string) => {
        // if (dateType === DateTypeEnum.YEARLY) {
        //   await this.getRefreshYearlyChannels();
        // cannot refresh yearly because lives on a different baseUrl
        // https://cafeastrology.com/2021-libra-horoscope-overview.html
        // }

        const date = $(this.getDateTypeHeader(dateType)).text();
        const channel: TextChannel = this.getHoroscopeChannel(channels, dateType)[0];
        const channelName: string = channel.name;

        const messages: string[] = Array.from(
          await channel.messages
          .fetch())
          .map(([id, message]: [string, Message]) => message.content
        );

        const channelHasMessages = messages.length > 0 ? true : false;
        const filteredMessages = messages.filter((message: string) => !message.includes(date));
  
        if (channelHasMessages && filteredMessages.length === 0) {
          this.postsUpToDate = true;
          log(`Channel already up to date: ${channelName}`);
        } else {
          const message: string = await this.createMessage(date, dateType);
          log(`Sending message: #${channelName}\n${message}`);
          await channel.send(message);
        }
      });
    });
  }

  public run = async (): Promise<void> => {
    this.startTime = new Date().toUTCString();

    log('Initializing Librot...', true);
    await this.initializeDiscord();
  }

  public stop = (): void => {
    const endTime: string = new Date().toUTCString();
    log(`Instagarden ran from ${this.startTime} - ${endTime}`);
  }

  public validateSetup = async (): Promise<void> => {
    // Add more validations here
    if (!discordConfig.token) {
      throw new Error('Please specify your Discord token!');
    }
  }
}

export const server = new Server();
server.validateSetup();
server.run().catch((error: Error) => log(`${error}`, true));
