require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const cooldowns = new Map();
const COOLDOWN_TIME = 600000; // 10 minutes

// --- SERVICES CONFIGURATION ---
const services = [
    { name: 'Crunchyroll', value: 'crunchyroll' },
    { name: 'Fortnite', value: 'fortnite' },
    { name: 'Netflix', value: 'netflix' },
    { name: 'Minecraft', value: 'minecraft' }
];

const commands = [
    new SlashCommandBuilder()
        .setName('gen')
        .setDescription('Generate an account')
        .addStringOption(opt => 
            opt.setName('service').setDescription('Select the service').setRequired(true).addChoices(...services)),
    
    new SlashCommandBuilder().setName('stock').setDescription('Check available stock'),
    
    new SlashCommandBuilder()
        .setName('restock')
        .setDescription('Add accounts to stock (Staff Only)')
        .addStringOption(opt => 
            opt.setName('service').setDescription('Service to restock').setRequired(true).addChoices(...services))
        .addStringOption(opt => 
            opt.setName('account').setDescription('Account data (user:pass)').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ Tomato Gen online as ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('🚀 Commands and Menus updated successfully.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, user, member } = interaction;

    // Helper to get correct file path
    const getPath = (srv) => (srv === 'crunchyroll') ? './stock.txt' : `./${srv}.txt`;

    // --- GEN COMMAND ---
    if (commandName === 'gen') {
        const service = options.getString('service');
        
        // Cooldown Check
        if (cooldowns.has(user.id)) {
            const exp = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (Date.now() < exp) {
                const left = Math.ceil((exp - Date.now()) / 60000);
                return await interaction.reply({ 
                    content: `❌ [PRIVATE] Please wait ${left} minute(s) before generating again!`, 
                    ephemeral: true 
                });
            }
        }

        const path = getPath(service);
        if (!fs.existsSync(path)) return await interaction.reply({ content: `❌ Error: ${service} file not found.`, ephemeral: true });

        let content = fs.readFileSync(path, 'utf8').trim();
        let accounts = content.split(/\s+/).filter(l => l.length > 0);

        if (accounts.length > 0) {
            const acc = accounts.shift();
            fs.writeFileSync(path, accounts.join(' '));

            const embed = new EmbedBuilder()
                .setTitle('🍅 Tomato Gen - Success!')
                .setDescription(`Your **${service}** account has been delivered.`)
                .setColor(0xFF6347)
                .addFields({ name: 'Account Details', value: `\`${acc}\`` })
                .setFooter({ text: 'Enjoy your account!' })
                .setTimestamp();

            try {
                await user.send({ embeds: [embed] });
                cooldowns.set(user.id, Date.now());
                await interaction.reply({ 
                    content: `✅ **${user.tag}** just generated a **${service}** account! Check your DMs.`, 
                    ephemeral: false 
                });
            } catch (e) {
                await interaction.reply({ content: '❌ Your DMs are closed!', ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `❌ Out of stock for **${service}**!`, ephemeral: false });
        }
    }

    // --- STOCK COMMAND ---
    if (commandName === 'stock') {
        const count = (f) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split(/\s+/).filter(x => x).length : 0;
        
        const stockEmbed = new EmbedBuilder()
            .setTitle('📊 Tomato Stock Status')
            .setColor(0x5865F2)
            .addFields(
                { name: '🟠 Crunchyroll', value: `${count('./stock.txt')}`, inline: true },
                { name: '🔫 Fortnite', value: `${count('./fortnite.txt')}`, inline: true },
                { name: '📺 Netflix', value: `${count('./netflix.txt')}`, inline: true },
                { name: '⛏️ Minecraft', value: `${count('./minecraft.txt')}`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [stockEmbed] });
    }

    // --- RESTOCK COMMAND ---
    if (commandName === 'restock') {
        const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) || member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return await interaction.reply({ content: "❌ You don't have permission!", ephemeral: true });

        const service = options.getString('service');
        const accountData = options.getString('account');
        const path = getPath(service);

        try {
            // Append with a space so they stay as separate accounts
            fs.appendFileSync(path, ` ${accountData}`);
            await interaction.reply({ content: `✅ Successfully added accounts to **${service}**!`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: "❌ Error writing to file.", ephemeral: true });
        }
    }
});

client.login(TOKEN);
          
