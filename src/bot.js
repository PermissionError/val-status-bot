import cron from 'node-cron';
import {TwitterApi} from 'twitter-api-v2';
import {RIOT_CDN_ENDPOINT_ACTIVE, REGIONS, CASE_TYPE, CASE_COMPLETED} from './constants.js';
import {
    getArrayDiffs,
    getNewestUpdate,
    getStatusByRegion,
    getStoredActiveCasesByRegion,
    getStoredActiveUpdatesByRegion,
    getTweetIdFromCaseId,
    regionShorthandToName,
    reportError,
    setCaseIdToTweetId,
    setStoredActiveCasesByRegion,
    setStoredActiveUpdatesByRegion,
    statusShorthandToName
} from './helpers.js';

import {OAUTH_TOKEN, OAUTH_SECRET, APP_KEY,APP_SECRET} from '../secrets.js';

const twitter = new TwitterApi({appKey: APP_KEY, appSecret: APP_SECRET, accessToken: OAUTH_TOKEN, accessSecret: OAUTH_SECRET});

const inspect = async () => {
    console.log('===BEGIN INSPECTION===');
    //Get active status
    for(let region of Object.values(REGIONS)) {
        let data = await getStatusByRegion(RIOT_CDN_ENDPOINT_ACTIVE, region);
        let storedCases = await getStoredActiveCasesByRegion(region);
        let riotCases = [];
        for(let maintenance of data.maintenances) {
            riotCases.push(maintenance.id);
        }
        for(let incident of data.incidents) {
            riotCases.push(incident.id);
        }
        const [newCases, completedCases, savedCases] = getArrayDiffs(riotCases, storedCases);
        if(savedCases.length === 0) {
            //Don't run out of disk space lul
            await setStoredActiveUpdatesByRegion(region, []);
        }
        //Tweet new cases
        for(let id of newCases) {
            let info = data.maintenances.find(value => value.id === id) ?? data.incidents.find(value => value.id === id);
            //Get newest update
            let newest = getNewestUpdate(info.updates);
            //Get English translations
            let enTitle = info.titles.find(title => title.locale === 'en_US').content;
            let enUpdate = newest.translations.find(update => update.locale === 'en_US').content;
            let type = info.maintenance_status ? CASE_TYPE.MAINTENANCE : CASE_TYPE.INCIDENT;
            //Tweet it!
            console.log('=====================');
            console.log(`Tweeting new case ${id}`)
            console.log(regionShorthandToName(region));
            console.log(type)
            console.log(statusShorthandToName(info.maintenance_status ?? info.incident_severity));
            console.log(enTitle);
            console.log(enUpdate);
            console.log('=====================');
            let tweet = await twitter.v2.tweet(`[${regionShorthandToName(region)}] [New ${type} Case]\n\n${statusShorthandToName(info.maintenance_status ?? info.incident_severity)}\n\n${enTitle}\n${enUpdate}`);
            await setCaseIdToTweetId(id, tweet.data.id);
            storedCases.push(id);
            await setStoredActiveCasesByRegion(region, storedCases);
            let stored = await getStoredActiveUpdatesByRegion(region);
            stored.push(newest.id);
            await setStoredActiveUpdatesByRegion(region, stored);
        }
        for(let id of completedCases) {
            console.log(`Case ${id} has been resolved/completed.`);
            let tweetId = await getTweetIdFromCaseId(id);
            await twitter.v2.reply(CASE_COMPLETED, tweetId);
            storedCases = storedCases.filter(value => value !== id);
            await setStoredActiveCasesByRegion(region, storedCases);
        }
        for(let id of savedCases) {
            let info = data.maintenances.find(value => value.id === id) ?? data.incidents.find(value => value.id);
            //Get newest update
            let newest = getNewestUpdate(info.updates);
            let stored = await getStoredActiveUpdatesByRegion(region);
            if(!stored.find(value => newest.id === value)) {
                //Tweet it!
                console.log(`Tweeting update id ${newest.id} for case ${id}`)
                let tweetId = await getTweetIdFromCaseId(id);
                await twitter.v2.reply(`Update: ${newest.translations.find(value => value.locale === 'en_US').content}`, tweetId);
                stored.push(newest.id);
                await setStoredActiveUpdatesByRegion(region, stored);
            }
        }
    }
    console.log('===END INSPECTION===');
}

process.on('uncaughtException', async(err) => {
    console.log('Caught exception: ' + err);
    await reportError();
});

const task = cron.schedule('*/5 * * * *', inspect, {});