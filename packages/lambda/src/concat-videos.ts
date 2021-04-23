import {
	GetObjectCommand,
	ListObjectsCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import {combineVideos} from '@remotion/renderer';
import {createWriteStream, existsSync, mkdirSync, rmdirSync} from 'fs';
import {join} from 'path';
import {Readable} from 'stream';
import xns from 'xns';
import {REGION} from './constants';
import {timer} from './timer';
import {tmpDir} from './tmpdir';

const downloadS3File = async ({
	s3Client,
	bucket,
	content,
	outdir,
}: {
	s3Client: S3Client;
	bucket: string;
	content: string;
	outdir: string;
}) => {
	const {Body} = await s3Client.send(
		new GetObjectCommand({
			Bucket: bucket,
			Key: content,
		})
	);
	const outpath = join(outdir, content);
	return new Promise<void>((resolve, reject) => {
		(Body as Readable)
			.pipe(createWriteStream(outpath))
			.on('error', (err) => reject(err))
			.on('close', () => resolve());
	});
};

const getAllFiles = async ({
	s3Client,
	bucket,
	expectedFiles,
	outdir,
}: {
	s3Client: S3Client;
	bucket: string;
	expectedFiles: number;
	outdir: string;
}): Promise<string[]> => {
	const alreadyDownloading: {[key: string]: true} = {};
	const downloaded: {[key: string]: true} = {};

	const getFiles = async () => {
		const lsTimer = timer('Listing files');
		const files = await s3Client.send(
			new ListObjectsCommand({
				Bucket: bucket,
			})
		);
		lsTimer();
		return (files.Contents || []).map((_) => _.Key as string);
	};

	return new Promise<string[]>((resolve, reject) => {
		const loop = async () => {
			const filesInBucket = await getFiles();
			const checkFinish = () => {
				const areAllFilesDownloaded =
					Object.keys(downloaded).length === expectedFiles;
				if (areAllFilesDownloaded) {
					resolve(filesInBucket.map((file) => join(outdir, file)));
				}
			};
			filesInBucket.forEach(async (content) => {
				if (alreadyDownloading[content]) {
					return;
				}
				alreadyDownloading[content] = true;
				try {
					await downloadS3File({
						bucket,
						content,
						outdir,
						s3Client,
					});
					downloaded[content] = true;
					checkFinish();
				} catch (err) {
					reject(err);
				}
			});

			const areAllFilesDownloading =
				Object.keys(alreadyDownloading).length === expectedFiles;
			if (!areAllFilesDownloading) {
				setTimeout(() => {
					loop();
				}, 300);
			}
		};

		loop();
	});
};

export const concatVideos = xns(
	async (
		s3Client: S3Client = new S3Client({region: REGION}),
		bucket = 'remotion-renders-0.7182592846197402',
		expectedFiles = 20
	) => {
		const outdir = join(tmpDir('remotion-concat'), 'bucket');
		if (existsSync(outdir)) {
			rmdirSync(outdir, {
				recursive: true,
			});
		}
		mkdirSync(outdir);

		const files = await getAllFiles({s3Client, bucket, expectedFiles, outdir});

		const outfile = join(tmpDir('remotion-concated'), 'concat.mp4');
		const combine = timer('Combine videos');
		const filelistDir = tmpDir('remotion-filelist');
		await combineVideos({
			files,
			filelistDir,
			output: outfile,
		});
		combine();

		rmdirSync(outdir, {
			recursive: true,
		});
		console.log(outfile);
	}
);