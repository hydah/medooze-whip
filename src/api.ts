import { Response, Request, Router } from 'express'
import express from 'express'
import config from './config'
const path = require('path')
const fs = require('fs')
const promisify = require('util').promisify
const readdir = promisify(fs.readdir)

const apiRouter = Router()

const MediaServer = require("medooze-media-server")

const SemanticSDP = require('semantic-sdp')

const SDPInfo = SemanticSDP.SDPInfo
const MediaInfo = SemanticSDP.MediaInfo
const CandidateInfo = SemanticSDP.CandidateInfo
const DTLSInfo = SemanticSDP.DTLSInfo
const ICEInfo = SemanticSDP.ICEInfo
const StreamInfo = SemanticSDP.StreamInfo
const TrackInfo = SemanticSDP.TrackInfo
const Direction = SemanticSDP.Direction
const CodecInfo = SemanticSDP.CodecInfo

// MediaServer.enableDebug(true)
// MediaServer.enableUltraDebug(true)


const endpoint = MediaServer.createEndpoint(config.endpoint)

let incomingStream = new Map();

apiRouter.get('/test', async (req: Request, res: Response) => {
    res.send('hello world')
})

apiRouter.get('/', async (req: Request, res: Response) => {
    console.log(__dirname)
    const files = await readdir(__dirname + '/../public');
    console.log(__dirname + './public')
    res.statusCode = 200
    res.type('html');
    var html_list = '<!doctype html> <html> <head></head> <body><div>';
    files.forEach(f => {
        console.log(f)
        html_list = html_list + "<a href=\"./public/" + f + '\">' + f + '</a>' + '<br />';
    });
    html_list = html_list + '</div></body></html>'
    console.log(html_list);
    res.end(html_list)
})

// 推流
apiRouter.post('/rtc/v1/whip/:endpoint', async (req: Request, res: Response) => {
    const streamName = req.params.endpoint
    console.log(`get publish sream ${streamName}...`)
    const sdp = SDPInfo.process(req.body)

    const transport = endpoint.createTransport(sdp)
    transport.setRemoteProperties(sdp)
    console.log(">>>> req offer sdp \n", sdp.toString())

    const answer = sdp.answer({
        dtls: transport.getLocalDTLSInfo(),
        ice: transport.getLocalICEInfo(),
        candidates: endpoint.getLocalCandidates(),
        capabilities: config.capabilities
    })

    transport.setLocalProperties(answer)

    // create stream map entry
    const offerStream = sdp.getFirstStream()
    const incoming = transport.createIncomingStream(offerStream)
    incomingStream.set(streamName, incoming)

    console.log("<<<<< res offer sdp\n", sdp.toString())
    res.type('application/sdp')
    res.status(201).send(answer.toString())
})

// 推流Update

// 拉流
apiRouter.post('/rtc/v1/whep/:endpoint', async (req: Request, res: Response) => {
    const streamName = req.params.endpoint
    console.log(`get play sream ${streamName}...`)

    if (!incomingStream.has(streamName)) {
        res.status(404).json({
            message: 'stream not found'
        })
        return
    }

    const sdp = SDPInfo.process(req.body)

    const transport = endpoint.createTransport(sdp)
    transport.setRemoteProperties(sdp)

    const answer = sdp.answer({
        dtls: transport.getLocalDTLSInfo(),
        ice: transport.getLocalICEInfo(),
        candidates: endpoint.getLocalCandidates(),
        capabilities: config.capabilities
    })

    transport.setLocalProperties(answer)
    console.log(transport.getLocalICEInfo().getUfrag())

    const outgoing = transport.createOutgoingStream({
        audio: true,
        video: true
    })
    outgoing.attachTo(incomingStream.get(streamName))

    answer.addStream(outgoing.getStreamInfo())
    res.type('application/sdp')
    res.status(201).send(answer.toString())

})

export default apiRouter