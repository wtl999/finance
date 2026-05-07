#!/bin/sh

for func in login userSync billService reportService aiClassify ocr deepseekParse aiAnalyze; do
  ${installPath} cloud functions deploy --e ${envId} --n ${func} --r --project ${projectPath}
done
