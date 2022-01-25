import { Response, Request, Router } from 'express'
import express from 'express'
import config from './config'
const path = require('path')
const fs = require('fs')
const promisify = require('util').promisify
const readdir = promisify(fs.readdir)

const apiRouter = Router()

const MediaServer = require("/data/code/tencent/learning/media-server-node/index")

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

MediaServer.enableDebug(true)
// MediaServer.enableUltraDebug(true)


const endpoint = MediaServer.createEndpoint(config.endpoint)

let incomingStream;

apiRouter.get('/test', async (req: Request, res: Response) => {
    res.send('hello world')
})

apiRouter.get('/', async (req: Request, res: Response) => {
    const files = await readdir(__dirname + '/../../public');
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

apiRouter.post('/rtc/v1/publish', async (req: Request, res: Response) => {
    console.log("get publish...")
    const sdp = SDPInfo.process(req.body.sdp)

    const transport = endpoint.createTransport(sdp)
    transport.setRemoteProperties(sdp)


    const answer = sdp.answer({
        dtls: transport.getLocalDTLSInfo(),
        ice: transport.getLocalICEInfo(),
        candidates: endpoint.getLocalCandidates(),
        capabilities: config.capabilities
    })

    transport.setLocalProperties(answer)

    const offerStream = sdp.getFirstStream()

    incomingStream = transport.createIncomingStream(offerStream)

    res.json({
        sdp: answer.toString()
    })
})

apiRouter.post('/rtc/v1/play', async (req: Request, res: Response) => {

    const sdp = SDPInfo.process(req.body.sdp)

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

    outgoing.attachTo(incomingStream)
    answer.addStream(outgoing.getStreamInfo())

    res.json({
        sdp: answer.toString()
    })

})

export default apiRouter