const fs = require('fs')
const path = require('path')
const commander = require('commander')
const {from, Observable} = require('rxjs')
const {mergeMap, switchMap} = require('rxjs/operators')
const {fromFetch} = require('rxjs/fetch')
const progressBar = require('progress')

commander
	.requiredOption('-u, --uid <number>', 'Weibo user object id')
	.requiredOption('-c, --cookie <number>', 'Weibo SUB')
	.requiredOption('-d, --directory <string>', 'Output directory', './')
	.option('-t, --threads <number>', 'Download threads', 10)
	.option('-i, --interval <number>', 'Analyze interval', 1200)
	.option('-l, --limit <number>', 'Limit the number of query pages')

commander.parse(process.argv)

let weiboUid = null
let weiboToken = null
const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36`
let thread = 5
let directory = null
let interval = null
let limit = null

if (commander.uid) {
	weiboUid = commander.uid
}
if (commander.cookie) {
	weiboToken = commander.cookie
}
if (commander.directory) {
	directory = path.join(commander.directory, weiboUid)
}
if (commander.threads) {
	thread = Number(commander.threads)
}
if (commander.interval) {
	interval = Number(commander.interval)
}
if (commander.limit) {
	limit = Number(commander.limit)
}

console.log('Input config')
console.table({
	uid: weiboUid,
	token: weiboToken,
	'output directory': directory,
	thread,
	interval,
	limit,
})

function writeUrlFile(items) {
	let str = ''

	for (const item of items) {
		str += `${item}\n`
	}

	fs.writeFileSync(path.join(directory, `weibo-${weiboUid}.txt`), str)
}

function delay(time) {
	return new Promise(resolve => setTimeout(() => resolve(), time))
}

async function getUserData() {
	try {
		const reqUrl = new URL('https://m.weibo.cn/api/container/getIndex')
		reqUrl.searchParams.set('type', 'uid')
		reqUrl.searchParams.set('value', weiboUid)
		const resp = await fetch(reqUrl, {
			headers: {
				cookie: `SUB=${weiboToken}`
			}
		})
		const result = await resp.json()

		if (result.ok === 1) {
			console.table({
				id: result.data.userInfo.id,
				name: result.data.userInfo.screen_name,
				verifiedReason: result.data.userInfo.verified_reason || 'Null',
				description: result.data.userInfo.description,
				weiboCount: result.data.userInfo.statuses_count,
				followCount: result.data.userInfo.follow_count,
				followersCount: result.data.userInfo.followers_count,
			})
		} else {
			console.log(result)
			throw 'Error getting user information'
		}
	} catch (err) {
		console.error(err)
	}
}

async function getUserWeiboPictures() {
	let page = 1
	let url = []
	let stop = false

	while (!stop) {
		if (limit !== null && page > limit) {
			break
		}

		try {
			const reqUrl = new URL('https://m.weibo.cn/api/container/getIndex')
			reqUrl.searchParams.set('type', 'uid')
			reqUrl.searchParams.set('containerid', `107603${weiboUid}`)
			reqUrl.searchParams.set('page', page)
			reqUrl.searchParams.set('count', 20)
			const resp = await fetch(reqUrl, {
				method: 'GET',
				headers: {
					cookie: `SUB=${weiboToken}`
				}
			})
			const result = await resp.json()

			if (result.ok === 1) {
				const miao = result.data.cards.filter(item => item.card_type === 9)
				let pics = []

				for (const item of miao) {
					if (Array.isArray(item?.mblog?.pics)) {
						pics = [...pics, ...item.mblog.pics]
					}
					if (Array.isArray(item?.mblog?.retweeted_status?.pics)) {
						pics = [...pics, ...item.mblog.retweeted_status.pics]
					}

					if (!!item?.mblog?.pics && !Array.isArray(item?.mblog?.pics) && typeof item?.mblog?.pics === "object") {
						pics = [...pics, ...Object.values(item.mblog.pics)]
					}

					if (!!item?.mblog?.retweeted_status?.pics && !Array.isArray(item?.mblog?.retweeted_status?.pics) && typeof item?.mblog?.retweeted_status?.pics === "object") {
						pics = [...pics, ...Object.values(item.mblog.retweeted_status.pics)]
					}
				}

				const pictures = []
				for (const item of pics) {
					const u = item?.large?.url
					if (/\/\/wx(1|2|3|4).sinaimg/ig.test(u)) {
						pictures.push(u)
					}
				}

				url = [...url, ...pictures]
				console.log(`Page: ${page}, Analyze picture: ${url.length}`)
				await delay(interval)
				page += 1
			} else {
				break
			}
		} catch (err) {
			console.error(err)
			break
		}
	}

	url = Array.from(new Set(url))

	fs.mkdirSync(directory, {recursive: true})
	writeUrlFile(url)
}

async function main() {
	await getUserData()
	await getUserWeiboPictures()
}

main()
