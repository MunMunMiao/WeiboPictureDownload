const fs = require('fs')
const path = require('path')
const axios = require('axios')
const commander = require('commander')
const {from, Observable} = require('rxjs')
const {mergeMap, switchMap} = require('rxjs/operators')
const progressBar = require('progress')

commander
	.requiredOption('-u, --uid <number>', 'Weibo user object id')
	.requiredOption('-c, --cookie <number>', 'Weibo SUB')
	.requiredOption('-d, --directory <string>', 'Output directory', './')
	.option('-t, --threads <number>', 'Download threads', 10)
	.option('-o, --output-file', 'Output files')
	.option('-i, --interval <number>', 'Analyze interval', 1200)
	.option('-l, --limit <number>', 'Limit the number of query pages')

commander.parse(process.argv)

let weiboUid = null
let weiboToken = null
const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36`
let thread = 5
let outputFile = false
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
if (commander.outputFile) {
	outputFile = true
}

console.log('Input config')
console.table({
	uid: weiboUid,
	token: weiboToken,
	'output directory': directory,
	thread,
	interval,
	limit,
	'output files': outputFile
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

function asyncWrite(path, data) {
	return new Observable(subscriber => {
		fs.writeFile(path, data, err => {
			if (err) {
				subscriber.error(err)
			} else {
				subscriber.next()
				subscriber.complete()
			}
		})
	})
}

function download(items) {
	let currentIndex = 0
	const bar = new progressBar(`Downloading [:bar] :current/:total :percent`, {
		curr: currentIndex,
		total: items.length,
		clear: true
	})

	from(items)
		.pipe(
			mergeMap(item => {
				return from(axios.get(item, {
					responseType: 'arraybuffer',
					headers: {
						'User-Agent': userAgent
					}
				})).pipe(switchMap(result => {
					const filename = result.request.path.match(/[a-zA-Z0-9.]*$/gi)[0]
					return asyncWrite(path.join(directory, filename), result.data)
				}))
			}, thread))
		.subscribe({
			next: result => {
				bar.tick()
			},
			complete: () => {
				process.exit()
			}
		})
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
						pics = [...pics, ...Object.values(item.mblog.retweeted_status.picss)]
					}
				}

				const pictures = []
				for (const item of pics){
					const u = item?.large?.url
					if (/\/\/wx(1|2|3|4).sinaimg/ig.test(u)){
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

	if (outputFile) {
		download(url)
	} else {
		process.exit()
	}
}

async function main() {
	await getUserData()
	await getUserWeiboPictures()
}

main()
